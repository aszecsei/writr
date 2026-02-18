import OpenAI from "openai";
import type { AiMessage, AiToolCall, FinishReason } from "../types";
import type { CompletionParams, ProviderAdapter } from "./types";

interface OpenAiAdapterConfig {
  baseURL: string;
  defaultHeaders?: Record<string, string>;
}

function normalizeFinishReason(raw: string | null | undefined): FinishReason {
  switch (raw) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "content_filter":
      return "content_filter";
    case "tool_calls":
      return "tool_use";
    default:
      return raw ? "unknown" : "stop";
  }
}

function isAnthropicModel(model: string): boolean {
  return model.startsWith("anthropic/");
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

/**
 * Strip `cache_control` from content parts — OpenAI-compatible APIs don't
 * support it, and SDK types may reject it.
 */
function convertMessages(
  messages: AiMessage[],
  isAnthropic: boolean,
): OpenAI.ChatCompletionMessageParam[] {
  if (isAnthropic) {
    // For Anthropic models through OpenRouter, pass messages with minimal transformation
    // but still handle tool-related roles
    return messages.map((msg) => {
      if (msg.role === "tool") {
        return {
          role: "tool" as const,
          tool_call_id: msg.toolCallId ?? "",
          content: typeof msg.content === "string" ? msg.content : "",
        };
      }
      if (msg.role === "assistant" && msg.toolCalls?.length) {
        return {
          role: "assistant" as const,
          content: typeof msg.content === "string" ? msg.content : "",
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        } as OpenAI.ChatCompletionMessageParam;
      }
      if (typeof msg.content === "string") {
        return {
          role: msg.role as "system" | "user" | "assistant",
          content: msg.content,
        };
      }
      return {
        role: msg.role,
        content: msg.content,
      } as unknown as OpenAI.ChatCompletionMessageParam;
    });
  }

  return messages.map((msg) => {
    if (msg.role === "tool") {
      return {
        role: "tool" as const,
        tool_call_id: msg.toolCallId ?? "",
        content: typeof msg.content === "string" ? msg.content : "",
      };
    }
    if (msg.role === "assistant" && msg.toolCalls?.length) {
      return {
        role: "assistant" as const,
        content: typeof msg.content === "string" ? msg.content || null : null,
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      } as OpenAI.ChatCompletionMessageParam;
    }
    if (typeof msg.content === "string") {
      return {
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      };
    }
    const parts: OpenAI.ChatCompletionContentPart[] = msg.content.map(
      (part) => {
        if (part.type === "text") {
          return { type: "text" as const, text: part.text };
        }
        return {
          type: "image_url" as const,
          image_url: { url: part.image_url.url },
        };
      },
    );
    return {
      role: msg.role,
      content: parts,
    } as OpenAI.ChatCompletionMessageParam;
  });
}

function buildToolsParam(params: CompletionParams): object {
  if (!params.tools?.length) return {};
  return {
    tools: params.tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.id,
        description: t.description,
        parameters: t.parameters,
      },
    })),
  };
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
            id: tc.id,
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

      // Accumulate tool calls across streaming chunks
      const toolCallAccumulator = new Map<
        number,
        { id: string; name: string; args: string }
      >();

      for await (const chunk of stream) {
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

          // Accumulate tool call deltas
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              const existing = toolCallAccumulator.get(idx);
              if (existing) {
                existing.args += tc.function?.arguments ?? "";
              } else {
                toolCallAccumulator.set(idx, {
                  id: tc.id ?? "",
                  name: tc.function?.name ?? "",
                  args: tc.function?.arguments ?? "",
                });
              }
            }
          }
        }

        if (choice?.finish_reason) {
          // Emit accumulated tool calls before the stop chunk
          if (choice.finish_reason === "tool_calls") {
            for (const [, tc] of [...toolCallAccumulator.entries()].sort(
              (a, b) => a[0] - b[0],
            )) {
              yield {
                type: "tool_use" as const,
                id: tc.id,
                name: tc.name,
                input: JSON.parse(tc.args || "{}"),
              };
            }
          }
          yield {
            type: "stop" as const,
            finishReason: normalizeFinishReason(choice.finish_reason),
          };
        }
      }
    },
  };
}
