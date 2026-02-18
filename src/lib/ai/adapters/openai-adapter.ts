import OpenAI from "openai";
import type { AiMessage, FinishReason } from "../types";
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
function stripCacheControl(
  messages: AiMessage[],
): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((msg) => {
    if (typeof msg.content === "string") {
      return { role: msg.role, content: msg.content };
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
    return { role: msg.role, content: parts };
  }) as OpenAI.ChatCompletionMessageParam[];
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
    return {
      model: params.model,
      messages: isAnthropicModel(params.model)
        ? (params.messages as unknown as OpenAI.ChatCompletionMessageParam[])
        : stripCacheControl(params.messages),
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      stream,
      ...buildReasoningParam(params),
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
        }

        if (choice?.finish_reason) {
          yield {
            type: "stop" as const,
            finishReason: normalizeFinishReason(choice.finish_reason),
          };
        }
      }
    },
  };
}
