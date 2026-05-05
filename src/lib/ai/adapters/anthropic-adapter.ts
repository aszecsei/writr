import Anthropic from "@anthropic-ai/sdk";
import type {
  AiMessage,
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
  switch (stopReason) {
    case "end_turn":
      return "stop";
    case "max_tokens":
      return "length";
    case "stop_sequence":
      return "stop";
    case "tool_use":
      return "tool_use";
    default:
      return stopReason ? "unknown" : "stop";
  }
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
      const hasImages = msg.content.some((p) => p.type === "image_url");
      const hasCacheControl = msg.content.some(
        (p) => p.type === "text" && p.cache_control,
      );
      if (hasImages || hasCacheControl) {
        nonSystemMessages.push({
          role: msg.role as "user" | "assistant",
          content: toAnthropicContent(msg.content),
        });
      } else {
        const text = msg.content
          .map((p) => (p.type === "text" ? p.text : ""))
          .join("");
        nonSystemMessages.push({
          role: msg.role as "user" | "assistant",
          content: text,
        });
      }
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
        if (block.type === "text") {
          text += block.text;
        } else if (block.type === "thinking") {
          reasoning += block.thinking;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: generateToolUseId(),
            name: block.name,
            arguments: block.input as Record<string, unknown>,
          });
        }
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
        if (event.type === "message_start") {
          const usage = (
            event as unknown as {
              message: { usage?: Record<string, number | undefined> };
            }
          ).message.usage;
          if (usage) {
            usageSeen = true;
            inputTokens = usage.input_tokens ?? 0;
            cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
            cacheReadTokens = usage.cache_read_input_tokens ?? 0;
            outputTokens = usage.output_tokens ?? 0;
          }
        } else if (event.type === "content_block_start") {
          const block = (
            event as {
              content_block: { type: string; id?: string; name?: string };
            }
          ).content_block;
          if (block.type === "tool_use") {
            currentToolUse = {
              name: block.name ?? "",
              inputJson: "",
            };
          }
        } else if (event.type === "content_block_delta") {
          const delta = event.delta;
          if (delta.type === "text_delta") {
            yield { type: "content" as const, text: delta.text };
          } else if (delta.type === "thinking_delta") {
            yield { type: "reasoning" as const, text: delta.thinking };
          } else if (delta.type === "input_json_delta" && currentToolUse) {
            currentToolUse.inputJson +=
              (delta as { partial_json?: string }).partial_json ?? "";
          }
        } else if (event.type === "content_block_stop") {
          if (currentToolUse) {
            yield {
              type: "tool_use" as const,
              id: generateToolUseId(),
              name: currentToolUse.name,
              input: JSON.parse(currentToolUse.inputJson || "{}"),
            };
            currentToolUse = null;
          }
        } else if (event.type === "message_delta") {
          // The final message_delta carries cumulative output_tokens (and
          // sometimes refines input/cache figures).
          const usage = (
            event as unknown as {
              usage?: Record<string, number | undefined>;
            }
          ).usage;
          if (usage) {
            usageSeen = true;
            if (typeof usage.output_tokens === "number") {
              outputTokens = usage.output_tokens;
            }
            if (typeof usage.input_tokens === "number") {
              inputTokens = usage.input_tokens;
            }
            if (typeof usage.cache_creation_input_tokens === "number") {
              cacheCreationTokens = usage.cache_creation_input_tokens;
            }
            if (typeof usage.cache_read_input_tokens === "number") {
              cacheReadTokens = usage.cache_read_input_tokens;
            }
          }
          if (event.delta.stop_reason) {
            const promptTokens =
              inputTokens + cacheCreationTokens + cacheReadTokens;
            yield {
              type: "stop" as const,
              finishReason: normalizeStopReason(event.delta.stop_reason),
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
            };
          }
        }
      }
    },
  };
}
