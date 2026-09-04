import Anthropic from "@anthropic-ai/sdk";
import { match, P } from "ts-pattern";
import type {
  AiMessage,
  AiStreamChunk,
  AiToolCall,
  ContentPart,
  FinishReason,
} from "../types";
import {
  extractTextContent,
  generateToolUseId,
  parseBase64ImageDataUrl,
} from "./helpers";
import type { CompletionParams, ProviderAdapter } from "./types";

function normalizeStopReason(
  stopReason: string | null | undefined,
): FinishReason {
  return (
    match(stopReason)
      .with("end_turn", (): FinishReason => "stop")
      .with("max_tokens", (): FinishReason => "length")
      .with("stop_sequence", (): FinishReason => "stop")
      .with("tool_use", (): FinishReason => "tool_use")
      // null, undefined, or empty string fall back to "stop".
      .with(P.union(null, undefined, ""), (): FinishReason => "stop")
      .otherwise((): FinishReason => "unknown")
  );
}

type AnthropicImageMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

function toAnthropicContent(
  parts: ContentPart[],
): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const part of parts) {
    if (part.type === "text") {
      blocks.push({
        type: "text",
        text: part.text,
        ...(part.cache_control ? { cache_control: part.cache_control } : {}),
      } as Anthropic.TextBlockParam);
    } else if (part.type === "image_url") {
      const parsed = parseBase64ImageDataUrl(part.image_url.url);
      if (parsed) {
        blocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: parsed.mimeType as AnthropicImageMediaType,
            data: parsed.data,
          },
        });
      } else {
        blocks.push({
          type: "image",
          source: { type: "url", url: part.image_url.url },
        } as Anthropic.ImageBlockParam);
      }
    }
  }
  return blocks;
}

interface ExtractedMessages {
  system: Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
}

function extractSystemMessages(messages: AiMessage[]): ExtractedMessages {
  const systemBlocks: Anthropic.TextBlockParam[] = [];
  const nonSystemMessages: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      if (typeof msg.content === "string") {
        systemBlocks.push({ type: "text", text: msg.content });
      } else {
        for (const part of msg.content) {
          if (part.type === "text") {
            systemBlocks.push({
              type: "text",
              text: part.text,
              ...(part.cache_control
                ? { cache_control: part.cache_control }
                : {}),
            } as Anthropic.TextBlockParam);
          }
        }
      }
    } else if (msg.role === "tool") {
      // Anthropic expects tool results as user messages with tool_result content blocks.
      // Propagate cache_control to the tool_result block so the caching marker
      // attached by `withTrailingCacheControl` survives the conversion.
      const { text, cacheControl } = extractTextContent(msg.content);
      nonSystemMessages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.toolCallId ?? "",
            content: text,
            ...(cacheControl ? { cache_control: cacheControl } : {}),
          },
        ],
      } as Anthropic.MessageParam);
    } else if (msg.role === "assistant" && msg.toolCalls?.length) {
      // Assistant message with tool use blocks
      const content: Anthropic.ContentBlockParam[] = [];
      const text = extractTextContent(msg.content).text;
      if (text) {
        content.push({ type: "text", text });
      }
      for (const tc of msg.toolCalls) {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        } as Anthropic.ContentBlockParam);
      }
      nonSystemMessages.push({ role: "assistant", content });
    } else if (typeof msg.content === "string") {
      nonSystemMessages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    } else {
      // Always preserve content-array shape — joining the parts back into a
      // string would flip the wire shape between tool-calling iterations:
      // the message trailing in iteration N would arrive as array form (with
      // cache_control) and as string form (no cache_control) in iteration
      // N+1, busting Anthropic's prefix-byte cache match.
      nonSystemMessages.push({
        role: msg.role as "user" | "assistant",
        content: toAnthropicContent(msg.content),
      });
    }
  }

  return { system: systemBlocks, messages: nonSystemMessages };
}

const BUDGET_MAP: Record<string, number> = {
  minimal: 1024,
  low: 4096,
  medium: 10240,
  high: 20480,
  xhigh: 32768,
};

const EFFORT_MAP: Record<string, string> = {
  xhigh: "max",
  high: "high",
  medium: "medium",
  low: "low",
  minimal: "low",
};

function isAdaptiveModel(model: string): boolean {
  return (
    model.startsWith("claude-opus-4-6") || model.startsWith("claude-sonnet-4-6")
  );
}

function hasThinking(
  reasoning: CompletionParams["reasoning"],
): reasoning is NonNullable<CompletionParams["reasoning"]> {
  return !!reasoning && reasoning.effort !== "none";
}

function getBudget(
  reasoning: NonNullable<CompletionParams["reasoning"]>,
): number {
  return BUDGET_MAP[reasoning.effort] ?? 10240;
}

function buildThinkingConfig(params: CompletionParams): object {
  if (hasThinking(params.reasoning)) {
    if (isAdaptiveModel(params.model)) {
      let effort = EFFORT_MAP[params.reasoning.effort] ?? "high";
      if (effort === "max" && !params.model.startsWith("claude-opus-4-6")) {
        effort = "high";
      }
      return {
        thinking: { type: "adaptive" },
        output_config: { effort },
      };
    }
    return {
      thinking: {
        type: "enabled",
        budget_tokens: getBudget(params.reasoning),
      },
    };
  }
  return { temperature: params.temperature };
}

function buildToolsParam(
  params: CompletionParams,
): { tools: Anthropic.Tool[] } | object {
  if (!params.tools?.length) return {};
  // Attach cache_control to the LAST tool entry — Anthropic treats this as a
  // single breakpoint that caches the entire tools section. Tools are stable
  // across iterations, so this is a high-leverage breakpoint for tool-calling
  // agents. (Counts toward the 4-breakpoint per-request cap.)
  const lastIdx = params.tools.length - 1;
  return {
    tools: params.tools.map((t, i) => ({
      name: t.id,
      description: t.description,
      input_schema: t.parameters as unknown as Anthropic.Tool.InputSchema,
      ...(i === lastIdx
        ? { cache_control: { type: "ephemeral" as const } }
        : {}),
    })),
  };
}

function buildRequestPayload(params: CompletionParams): {
  model: string;
  messages: Anthropic.MessageParam[];
  max_tokens: number;
  system?: Anthropic.TextBlockParam[];
  temperature?: number;
  thinking?: { type: "adaptive" | "enabled"; budget_tokens?: number };
  output_config?: { effort: string };
  tools?: Anthropic.Tool[];
} {
  const { system, messages } = extractSystemMessages(params.messages);
  return {
    model: params.model,
    ...(system.length > 0 ? { system } : {}),
    messages,
    max_tokens: params.maxTokens,
    ...buildThinkingConfig(params),
    ...buildToolsParam(params),
  };
}

export function createAnthropicAdapter(): ProviderAdapter {
  return {
    async complete(apiKey, params, signal) {
      const client = new Anthropic({ apiKey });

      const response = await client.messages.create(
        buildRequestPayload(
          params,
        ) as Anthropic.MessageCreateParamsNonStreaming,
        { signal },
      );

      let text = "";
      let reasoning = "";
      const toolCalls: AiToolCall[] = [];
      for (const block of response.content) {
        match(block)
          .with({ type: "text" }, (b) => {
            text += b.text;
          })
          .with({ type: "thinking" }, (b) => {
            reasoning += b.thinking;
          })
          .with({ type: "tool_use" }, (b) => {
            toolCalls.push({
              id: generateToolUseId(),
              name: b.name,
              arguments: b.input as Record<string, unknown>,
            });
          })
          .otherwise(() => {
            // Other content block kinds (server tool results, redacted
            // thinking, etc.) are not surfaced into our internal AiResponse.
          });
      }

      const cacheCreationTokens =
        response.usage.cache_creation_input_tokens ?? 0;
      const cacheReadTokens = response.usage.cache_read_input_tokens ?? 0;
      const promptTokens =
        response.usage.input_tokens + cacheCreationTokens + cacheReadTokens;
      const completionTokens = response.usage.output_tokens;
      return {
        content: text,
        reasoning: reasoning || undefined,
        model: response.model,
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
          ...(cacheCreationTokens > 0
            ? { cache_creation_tokens: cacheCreationTokens }
            : {}),
          ...(cacheReadTokens > 0
            ? { cache_read_tokens: cacheReadTokens }
            : {}),
        },
        finishReason: normalizeStopReason(response.stop_reason),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    },

    async *stream(apiKey, params, signal) {
      const client = new Anthropic({ apiKey });

      const stream = client.messages.stream(
        buildRequestPayload(params) as Anthropic.MessageCreateParamsStreaming,
        { signal },
      );

      // Track current tool_use block being streamed. Id is minted at emit
      // time, not taken from the upstream block.
      let currentToolUse: {
        name: string;
        inputJson: string;
      } | null = null;

      // Accumulate usage across stream events. message_start carries the
      // initial input/cache split; message_delta carries cumulative output
      // and (since 2024-10) finalized input/cache values. Stays null until
      // we see at least one usage payload — keeps `stop` clean on tests/
      // upstream paths that omit usage.
      let usageSeen = false;
      let inputTokens = 0;
      let cacheCreationTokens = 0;
      let cacheReadTokens = 0;
      let outputTokens = 0;

      for await (const event of stream) {
        // Match yields per-event side effects; tool_use start/stop transitions
        // mutate `currentToolUse`; deltas yield chunks via a buffered queue.
        const yields: AiStreamChunk[] = [];

        match(event)
          .with({ type: "message_start" }, (e) => {
            // Test fixtures and some upstream paths omit message.usage even
            // though the SDK types it as required.
            const usage = e.message.usage as typeof e.message.usage | undefined;
            if (!usage) return;
            usageSeen = true;
            inputTokens = usage.input_tokens ?? 0;
            cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
            cacheReadTokens = usage.cache_read_input_tokens ?? 0;
            outputTokens = usage.output_tokens ?? 0;
          })
          .with({ type: "content_block_start" }, (e) => {
            if (e.content_block.type === "tool_use") {
              currentToolUse = {
                name: e.content_block.name,
                inputJson: "",
              };
            }
          })
          .with({ type: "content_block_delta" }, (e) => {
            match(e.delta)
              .with({ type: "text_delta" }, (d) => {
                yields.push({ type: "content", text: d.text });
              })
              .with({ type: "thinking_delta" }, (d) => {
                yields.push({ type: "reasoning", text: d.thinking });
              })
              .with({ type: "input_json_delta" }, (d) => {
                if (currentToolUse) {
                  currentToolUse.inputJson += d.partial_json;
                }
              })
              // citations_delta and signature_delta are not surfaced.
              .with(
                { type: P.union("citations_delta", "signature_delta") },
                () => undefined,
              )
              .exhaustive();
          })
          .with({ type: "content_block_stop" }, () => {
            if (currentToolUse) {
              yields.push({
                type: "tool_use",
                id: generateToolUseId(),
                name: currentToolUse.name,
                input: JSON.parse(currentToolUse.inputJson || "{}"),
              });
              currentToolUse = null;
            }
          })
          .with({ type: "message_delta" }, (e) => {
            // The final message_delta carries cumulative output_tokens (and
            // sometimes refines input/cache figures). usage may be omitted on
            // upstream paths that don't surface accounting per delta.
            const usage = e.usage as typeof e.usage | undefined;
            if (usage) {
              usageSeen = true;
              if (usage.output_tokens != null)
                outputTokens = usage.output_tokens;
              if (usage.input_tokens != null) inputTokens = usage.input_tokens;
              if (usage.cache_creation_input_tokens != null)
                cacheCreationTokens = usage.cache_creation_input_tokens;
              if (usage.cache_read_input_tokens != null)
                cacheReadTokens = usage.cache_read_input_tokens;
            }
            if (e.delta.stop_reason) {
              const promptTokens =
                inputTokens + cacheCreationTokens + cacheReadTokens;
              yields.push({
                type: "stop",
                finishReason: normalizeStopReason(e.delta.stop_reason),
                ...(usageSeen
                  ? {
                      usage: {
                        prompt_tokens: promptTokens,
                        completion_tokens: outputTokens,
                        total_tokens: promptTokens + outputTokens,
                        ...(cacheCreationTokens > 0
                          ? { cache_creation_tokens: cacheCreationTokens }
                          : {}),
                        ...(cacheReadTokens > 0
                          ? { cache_read_tokens: cacheReadTokens }
                          : {}),
                      },
                    }
                  : {}),
              });
            }
          })
          .with({ type: "message_stop" }, () => {
            // No-op; usage and stop are emitted on message_delta.
          })
          .exhaustive();

        for (const chunk of yields) yield chunk;
      }
    },
  };
}
