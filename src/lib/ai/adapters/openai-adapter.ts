import OpenAI from "openai";
import { match, P } from "ts-pattern";
import type { AiMessage, AiToolCall, FinishReason } from "../types";
import { extractTextContent, generateToolUseId } from "./helpers";
import type { CompletionParams, ProviderAdapter } from "./types";

interface OpenAiAdapterConfig {
  baseURL: string;
  defaultHeaders?: Record<string, string>;
}

function normalizeFinishReason(raw: string | null | undefined): FinishReason {
  return match(raw)
    .with("stop", (): FinishReason => "stop")
    .with("length", (): FinishReason => "length")
    .with("content_filter", (): FinishReason => "content_filter")
    .with("tool_calls", (): FinishReason => "tool_use")
    .with(P.union(null, undefined, ""), (): FinishReason => "stop")
    .otherwise((): FinishReason => "unknown");
}

function isAnthropicModel(model: string): boolean {
  return model.startsWith("anthropic/");
}

/**
 * Extract cache token counts from an OpenAI-compatible usage object.
 *
 * OpenRouter exposes prompt-cache stats two different ways depending on the
 * upstream route:
 *   - `prompt_tokens_details.cached_tokens` — OpenAI-style "cached input"
 *     count (what was *read* from the cache).
 *   - `cache_write_tokens` — top-level field on the OpenRouter response,
 *     mapping to Anthropic's `cache_creation_input_tokens`.
 *
 * Both are optional — non-OpenRouter providers won't return them, and
 * OpenRouter omits them on routes that don't support caching.
 */
function extractCacheUsage(usage: unknown): {
  cache_creation_tokens?: number;
  cache_read_tokens?: number;
} {
  const u = usage as
    | {
        prompt_tokens_details?: { cached_tokens?: number };
        cache_write_tokens?: number;
      }
    | null
    | undefined;
  if (!u) return {};
  const cacheRead = u.prompt_tokens_details?.cached_tokens;
  const cacheWrite = u.cache_write_tokens;
  return {
    ...(typeof cacheWrite === "number" && cacheWrite > 0
      ? { cache_creation_tokens: cacheWrite }
      : {}),
    ...(typeof cacheRead === "number" && cacheRead > 0
      ? { cache_read_tokens: cacheRead }
      : {}),
  };
}

function isClaude46(model: string): boolean {
  return isAnthropicModel(model) && (/4\.6/.test(model) || /4-6/.test(model));
}

const VERBOSITY_MAP: Record<string, string> = {
  xhigh: "max",
  high: "high",
  medium: "medium",
  low: "low",
  minimal: "low",
};

function buildReasoningParam(params: CompletionParams): object {
  if (!params.reasoning) return {};
  if (isClaude46(params.model)) {
    // OpenRouter ignores reasoning.effort for Claude 4.6;
    // use verbosity (maps to output_config.effort) instead
    return {
      reasoning: { enabled: true },
      verbosity: VERBOSITY_MAP[params.reasoning.effort] ?? "medium",
    };
  }
  return { reasoning: params.reasoning };
}

function toolCallsToOpenAI(
  toolCalls: AiToolCall[],
): OpenAI.ChatCompletionMessageToolCall[] {
  return toolCalls.map((tc) => ({
    id: tc.id,
    type: "function" as const,
    function: {
      name: tc.name,
      arguments: JSON.stringify(tc.arguments),
    },
  }));
}

/**
 * Convert a single AiMessage to an OpenAI chat-completion message param.
 *
 * For non-Anthropic models, strips `cache_control` from content parts —
 * OpenAI-compatible APIs don't support it and the SDK types may reject it.
 *
 * For Anthropic models routed through OpenRouter, sends history-bound message
 * content (user, tool, assistant-with-tool-calls) as a content-block ARRAY
 * regardless of whether `cache_control` is currently attached. The wire shape
 * must be byte-stable across tool-calling iterations — Anthropic's prompt
 * cache is a prefix-byte match, so a previously-trailing message that flips
 * from array form (iter N, with cache_control) to string form (iter N+1, no
 * cache_control) silently busts the cache. Always-array preserves the prefix.
 * `cache_control` itself is a directive and not part of the cache key, so
 * adding/removing the marker between iterations is safe — but the surrounding
 * structure must stay identical.
 *
 * System messages stay as bare strings: the chat flow never marks the system
 * message with cache_control, so its shape is already stable.
 *
 * The `as unknown as` casts are unavoidable: the OpenAI SDK types model `tool`
 * content as `string` and reject extra fields on text parts, while OpenRouter's
 * Anthropic route accepts the richer shapes — the cast lives here so callers
 * don't have to think about it.
 */
function toOpenAIMessage(
  msg: AiMessage,
  isAnthropic: boolean,
): OpenAI.ChatCompletionMessageParam {
  return match(msg)
    .with({ role: "tool" }, (m): OpenAI.ChatCompletionMessageParam => {
      const { text, cacheControl } = extractTextContent(m.content);
      if (isAnthropic) {
        // Always array-form for Anthropic so wire shape stays stable across
        // iterations. cache_control is added only when present.
        const part: Record<string, unknown> = { type: "text", text };
        if (cacheControl) part.cache_control = cacheControl;
        return {
          role: "tool",
          tool_call_id: m.toolCallId ?? "",
          content: [part],
        } as unknown as OpenAI.ChatCompletionMessageParam;
      }
      return {
        role: "tool",
        tool_call_id: m.toolCallId ?? "",
        content: text,
      };
    })
    .with(
      { role: "assistant", toolCalls: P.nonNullable },
      // Empty toolCalls array falls through to the default branch.
      (m) => m.toolCalls.length > 0,
      (m): OpenAI.ChatCompletionMessageParam => {
        const { text, cacheControl } = extractTextContent(m.content);
        if (isAnthropic) {
          // Always array-form for Anthropic. Empty `text` is allowed — the
          // assistant message can be tool_calls only, with no preamble — but
          // an empty text part is odd shape, so omit `content` in that case
          // to match how Anthropic's SDK natively serializes a tool-call-only
          // turn (content: null).
          const part: Record<string, unknown> = { type: "text", text };
          if (cacheControl) part.cache_control = cacheControl;
          return {
            role: "assistant",
            content: text ? [part] : null,
            tool_calls: toolCallsToOpenAI(m.toolCalls),
          } as unknown as OpenAI.ChatCompletionMessageParam;
        }
        return {
          role: "assistant",
          content: text || null,
          tool_calls: toolCallsToOpenAI(m.toolCalls),
        };
      },
    )
    .otherwise((m): OpenAI.ChatCompletionMessageParam => {
      // System messages stay as plain strings — the chat flow never marks the
      // system message with cache_control, so its shape is already stable.
      // Wrapping system in a content array would change the wire shape and
      // could itself bust caching for any deployment that previously cached
      // against the string form.
      if (m.role === "system") {
        if (typeof m.content === "string") {
          return { role: "system", content: m.content };
        }
        // Array-form system message (rare): pass parts through verbatim for
        // Anthropic, strip cache_control for non-Anthropic.
        if (isAnthropic) {
          return {
            role: "system",
            content: m.content,
          } as unknown as OpenAI.ChatCompletionMessageParam;
        }
        // System messages only allow text parts; drop any image parts that
        // somehow ended up here (the chat flow never emits them).
        const parts: OpenAI.ChatCompletionContentPartText[] = m.content
          .filter((p): p is typeof p & { type: "text" } => p.type === "text")
          .map((p) => ({ type: "text" as const, text: p.text }));
        return { role: "system", content: parts };
      }

      // User / assistant-without-tool-calls messages.
      if (isAnthropic) {
        // Always array-form for Anthropic so wire shape stays stable across
        // iterations, even when a previously-trailing message no longer
        // carries cache_control.
        const parts: ContentPartLike[] =
          typeof m.content === "string"
            ? [{ type: "text", text: m.content }]
            : (m.content as ContentPartLike[]);
        return {
          role: m.role,
          content: parts,
        } as unknown as OpenAI.ChatCompletionMessageParam;
      }
      if (typeof m.content === "string") {
        return {
          role: m.role as "user" | "assistant",
          content: m.content,
        };
      }
      const parts: OpenAI.ChatCompletionContentPart[] = m.content.map((part) =>
        part.type === "text"
          ? { type: "text" as const, text: part.text }
          : {
              type: "image_url" as const,
              image_url: { url: part.image_url.url },
            },
      );
      return {
        role: m.role,
        content: parts,
      } as OpenAI.ChatCompletionMessageParam;
    });
}

// Local alias so we can pass ContentPart-shaped values through to OpenRouter
// without forcing them through the OpenAI SDK's stricter ChatCompletionContent-
// Part union. Anthropic accepts the richer shape (cache_control, etc.).
type ContentPartLike =
  | { type: "text"; text: string; cache_control?: { type: "ephemeral" } }
  | { type: "image_url"; image_url: { url: string } };

function convertMessages(
  messages: AiMessage[],
  isAnthropic: boolean,
): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((msg) => toOpenAIMessage(msg, isAnthropic));
}

function buildToolsParam(params: CompletionParams): object {
  if (!params.tools?.length) return {};
  // For Anthropic via OpenRouter, attach cache_control to the LAST tool entry
  // so the entire tools section is cached as a single breakpoint. Tools are
  // stable across iterations — high-leverage cache target. Other providers
  // don't honor cache_control on tools, so leave them alone.
  const isAnthropic = isAnthropicModel(params.model);
  const lastIdx = params.tools.length - 1;
  return {
    tools: params.tools.map((t, i) => ({
      type: "function" as const,
      function: {
        name: t.id,
        description: t.description,
        parameters: t.parameters,
      },
      ...(isAnthropic && i === lastIdx
        ? { cache_control: { type: "ephemeral" as const } }
        : {}),
    })),
  } as unknown as { tools: OpenAI.ChatCompletionTool[] };
}

export function createOpenAiAdapter(
  config: OpenAiAdapterConfig,
): ProviderAdapter {
  const createClient = (apiKey: string) =>
    new OpenAI({
      apiKey,
      baseURL: config.baseURL,
      defaultHeaders: config.defaultHeaders,
    });

  function buildRequestPayload(
    params: CompletionParams,
    stream: boolean,
  ):
    | OpenAI.ChatCompletionCreateParamsNonStreaming
    | OpenAI.ChatCompletionCreateParamsStreaming {
    const isAnthropic = isAnthropicModel(params.model);
    return {
      model: params.model,
      messages: convertMessages(params.messages, isAnthropic),
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      stream,
      // Ask for usage on streaming responses. Without this, OpenAI-compatible
      // APIs omit the usage object entirely from the stream.
      ...(stream ? { stream_options: { include_usage: true } } : {}),
      ...buildReasoningParam(params),
      ...buildToolsParam(params),
    };
  }

  return {
    async complete(apiKey, params, signal) {
      const client = createClient(apiKey);

      const response = (await client.chat.completions.create(
        buildRequestPayload(
          params,
          false,
        ) as OpenAI.ChatCompletionCreateParamsNonStreaming,
        { signal },
      )) as OpenAI.ChatCompletion & {
        choices: { message: { reasoning?: string } }[];
      };

      const choice = response.choices[0];
      const message = choice?.message as OpenAI.ChatCompletionMessage & {
        reasoning?: string;
      };

      let toolCalls: AiToolCall[] | undefined;
      if (message?.tool_calls?.length) {
        toolCalls = message.tool_calls
          .filter(
            (
              tc,
            ): tc is typeof tc & {
              type: "function";
              function: { name: string; arguments: string };
            } => tc.type === "function" && "function" in tc,
          )
          .map((tc) => ({
            id: generateToolUseId(),
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments || "{}"),
          }));
      }

      return {
        content: message?.content ?? "",
        reasoning: message?.reasoning,
        model: response.model,
        usage: response.usage
          ? {
              prompt_tokens: response.usage.prompt_tokens,
              completion_tokens: response.usage.completion_tokens ?? 0,
              total_tokens: response.usage.total_tokens,
              ...extractCacheUsage(response.usage),
            }
          : undefined,
        finishReason: normalizeFinishReason(choice?.finish_reason),
        toolCalls,
      };
    },

    async *stream(apiKey, params, signal) {
      const client = createClient(apiKey);

      const stream = await client.chat.completions.create(
        buildRequestPayload(
          params,
          true,
        ) as OpenAI.ChatCompletionCreateParamsStreaming,
        { signal },
      );

      // Accumulate tool calls across streaming chunks (keyed by upstream
      // index). Ids are minted at emit time, not tracked here.
      const toolCallAccumulator = new Map<
        number,
        { name: string; args: string }
      >();

      // Capture the finish reason and emit tool_use/stop ONCE at end of stream.
      // OpenRouter (notably the Azure-via-Anthropic route) sometimes emits the
      // finalization chunk twice; emitting per-chunk would duplicate tool_use
      // payloads downstream.
      let finalFinishReason: string | null = null;
      // Captured from the final chunk when `stream_options.include_usage` is
      // honored upstream. May remain null if a provider strips it.
      let finalUsage: OpenAI.CompletionUsage | null = null;

      for await (const chunk of stream) {
        if (chunk.usage) {
          finalUsage = chunk.usage;
        }
        const choice = chunk.choices[0];
        const delta = choice?.delta as
          | (OpenAI.ChatCompletionChunk.Choice.Delta & {
              reasoning?: string;
              reasoning_details?: { text?: string }[];
            })
          | undefined;

        if (delta) {
          // Reasoning tokens (OpenRouter extension)
          if (Array.isArray(delta.reasoning_details)) {
            for (const detail of delta.reasoning_details) {
              if (detail?.text) {
                yield { type: "reasoning" as const, text: detail.text };
              }
            }
          } else if (delta.reasoning) {
            yield { type: "reasoning" as const, text: delta.reasoning };
          }

          if (delta.content) {
            yield { type: "content" as const, text: delta.content };
          }

          // Accumulate tool call deltas keyed by index. Some providers
          // (notably OpenRouter relaying Anthropic) split the name across
          // chunks rather than putting it on the first delta — fill it in
          // opportunistically. The upstream id is discarded; we mint our own
          // at emit time so it can never be empty or collide.
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              const existing = toolCallAccumulator.get(idx);
              if (existing) {
                if (!existing.name && tc.function?.name) {
                  existing.name = tc.function.name;
                }
                existing.args += tc.function?.arguments ?? "";
              } else {
                toolCallAccumulator.set(idx, {
                  name: tc.function?.name ?? "",
                  args: tc.function?.arguments ?? "",
                });
              }
            }
          }
        }

        if (choice?.finish_reason && !finalFinishReason) {
          finalFinishReason = choice.finish_reason;
        }
      }

      if (finalFinishReason === "tool_calls") {
        for (const [, tc] of [...toolCallAccumulator.entries()].sort(
          (a, b) => a[0] - b[0],
        )) {
          yield {
            type: "tool_use" as const,
            id: generateToolUseId(),
            name: tc.name,
            input: JSON.parse(tc.args || "{}"),
          };
        }
      }

      if (finalFinishReason) {
        yield {
          type: "stop" as const,
          finishReason: normalizeFinishReason(finalFinishReason),
          ...(finalUsage
            ? {
                usage: {
                  prompt_tokens: finalUsage.prompt_tokens,
                  completion_tokens: finalUsage.completion_tokens ?? 0,
                  total_tokens: finalUsage.total_tokens,
                  ...extractCacheUsage(finalUsage),
                },
              }
            : {}),
        };
      }
    },
  };
}
