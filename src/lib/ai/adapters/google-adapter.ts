import { GoogleGenAI } from "@google/genai";
import type {
  AiMessage,
  AiToolCall,
  ContentPart,
  FinishReason,
} from "../types";
import { parseBase64ImageDataUrl } from "./helpers";
import type { CompletionParams, ProviderAdapter } from "./types";

interface GoogleAdapterConfig {
  mode: "api-key" | "vertex";
}

function normalizeFinishReason(raw: string | null | undefined): FinishReason {
  switch (raw) {
    case "STOP":
      return "stop";
    case "MAX_TOKENS":
      return "length";
    case "SAFETY":
    case "BLOCKLIST":
      return "content_filter";
    default:
      return raw ? "unknown" : "stop";
  }
}

interface GooglePart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

function toGoogleParts(parts: ContentPart[]): GooglePart[] {
  const result: GooglePart[] = [];
  for (const part of parts) {
    if (part.type === "text") {
      result.push({ text: part.text });
    } else if (part.type === "image_url") {
      const parsed = parseBase64ImageDataUrl(part.image_url.url);
      if (parsed) {
        result.push({
          inlineData: { mimeType: parsed.mimeType, data: parsed.data },
        });
      } else {
        result.push({ text: `[Image: ${part.image_url.url}]` });
      }
    }
  }
  return result;
}

interface GoogleMessage {
  role: "user" | "model";
  parts: GooglePart[];
}

interface ExtractedMessages {
  systemInstruction: string | undefined;
  messages: GoogleMessage[];
}

function extractSystemMessages(messages: AiMessage[]): ExtractedMessages {
  const systemParts: string[] = [];
  const nonSystemMessages: GoogleMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      if (typeof msg.content === "string") {
        systemParts.push(msg.content);
      } else {
        for (const part of msg.content) {
          if (part.type === "text") {
            systemParts.push(part.text);
          }
        }
      }
    } else if (msg.role === "tool") {
      // Google expects function responses in user role messages
      nonSystemMessages.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: msg.toolCallId ?? "unknown",
              response: JSON.parse(
                typeof msg.content === "string" ? msg.content : "{}",
              ),
            },
          },
        ],
      });
    } else if (msg.role === "assistant" && msg.toolCalls?.length) {
      // Assistant message with function calls
      const parts: GooglePart[] = [];
      if (typeof msg.content === "string" && msg.content) {
        parts.push({ text: msg.content });
      }
      for (const tc of msg.toolCalls) {
        parts.push({
          functionCall: { name: tc.name, args: tc.arguments },
        });
      }
      nonSystemMessages.push({ role: "model", parts });
    } else {
      const role = msg.role === "assistant" ? "model" : "user";
      if (typeof msg.content === "string") {
        nonSystemMessages.push({ role, parts: [{ text: msg.content }] });
      } else {
        nonSystemMessages.push({ role, parts: toGoogleParts(msg.content) });
      }
    }
  }

  return {
    systemInstruction:
      systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    messages: nonSystemMessages,
  };
}

const BUDGET_MAP: Record<string, number> = {
  minimal: 128,
  low: 1024,
  medium: 8192,
  high: 24576,
  xhigh: 32768,
};

function buildThinkingConfig(params: CompletionParams): object {
  if (params.reasoning && params.reasoning.effort !== "none") {
    return {
      thinkingConfig: {
        thinkingBudget: BUDGET_MAP[params.reasoning.effort] ?? 8192,
      },
    };
  }
  return {};
}

function buildToolsParam(params: CompletionParams): object {
  if (!params.tools?.length) return {};
  return {
    tools: [
      {
        functionDeclarations: params.tools.map((t) => ({
          name: t.id,
          description: t.description,
          parameters: t.parameters,
        })),
      },
    ],
  };
}

function buildRequestPayload(params: CompletionParams, signal?: AbortSignal) {
  const { systemInstruction, messages } = extractSystemMessages(
    params.messages,
  );
  return {
    model: params.model,
    contents: messages,
    config: {
      ...(systemInstruction ? { systemInstruction } : {}),
      temperature: params.temperature,
      maxOutputTokens: params.maxTokens,
      ...buildThinkingConfig(params),
      ...buildToolsParam(params),
      ...(signal ? { abortSignal: signal } : {}),
    },
  };
}

function createClient(
  config: GoogleAdapterConfig,
  apiKey: string,
): GoogleGenAI {
  if (config.mode === "vertex") {
    const [project, location] = apiKey.split(":");
    return new GoogleGenAI({
      vertexai: true,
      project: project || "",
      location: location || "us-central1",
    });
  }
  return new GoogleGenAI({ apiKey });
}

export function createGoogleAdapter(
  config: GoogleAdapterConfig,
): ProviderAdapter {
  return {
    async complete(apiKey, params, signal) {
      const client = createClient(config, apiKey);
      const response = await client.models.generateContent(
        buildRequestPayload(params, signal),
      );

      let text = "";
      let reasoning = "";
      const toolCalls: AiToolCall[] = [];
      const candidate = response.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.thought) {
            reasoning += part.text ?? "";
          } else if (part.functionCall) {
            toolCalls.push({
              id: `google-tc-${crypto.randomUUID()}`,
              name: part.functionCall.name ?? "",
              arguments: (part.functionCall.args ?? {}) as Record<
                string,
                unknown
              >,
            });
          } else if (part.text) {
            text += part.text;
          }
        }
      }

      const hasToolCalls = toolCalls.length > 0;
      return {
        content: text,
        reasoning: reasoning || undefined,
        model: params.model,
        usage: response.usageMetadata
          ? {
              prompt_tokens: response.usageMetadata.promptTokenCount ?? 0,
              completion_tokens:
                response.usageMetadata.candidatesTokenCount ?? 0,
              total_tokens: response.usageMetadata.totalTokenCount ?? 0,
            }
          : undefined,
        finishReason: hasToolCalls
          ? "tool_use"
          : normalizeFinishReason(candidate?.finishReason),
        toolCalls: hasToolCalls ? toolCalls : undefined,
      };
    },

    async *stream(apiKey, params, signal) {
      const client = createClient(config, apiKey);
      const stream = await client.models.generateContentStream(
        buildRequestPayload(params, signal),
      );

      for await (const response of stream) {
        const candidate = response.candidates?.[0];
        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.thought) {
              if (part.text) {
                yield { type: "reasoning" as const, text: part.text };
              }
            } else if (part.functionCall) {
              // Google sends complete function calls (no incremental JSON)
              yield {
                type: "tool_use" as const,
                id: `google-tc-${crypto.randomUUID()}`,
                name: part.functionCall.name ?? "",
                input: (part.functionCall.args ?? {}) as Record<
                  string,
                  unknown
                >,
              };
            } else if (part.text) {
              yield { type: "content" as const, text: part.text };
            }
          }
        }
        if (candidate?.finishReason) {
          yield {
            type: "stop" as const,
            finishReason: normalizeFinishReason(candidate.finishReason),
          };
        }
      }
    },
  };
}
