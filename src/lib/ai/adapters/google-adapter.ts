import { GoogleGenAI } from "@google/genai";
import type { AiMessage, ContentPart, FinishReason } from "../types";
import type { ProviderAdapter } from "./types";

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

function parseDataUrl(url: string): {
  mimeType: string;
  data: string;
} | null {
  const match = url.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

interface GooglePart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

function toGoogleParts(parts: ContentPart[]): GooglePart[] {
  const result: GooglePart[] = [];
  for (const part of parts) {
    if (part.type === "text") {
      result.push({ text: part.text });
    } else if (part.type === "image_url") {
      const parsed = parseDataUrl(part.image_url.url);
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
      const { systemInstruction, messages } = extractSystemMessages(
        params.messages,
      );

      const thinkingConfig =
        params.reasoning && params.reasoning.effort !== "none"
          ? {
              thinkingConfig: {
                thinkingBudget: BUDGET_MAP[params.reasoning.effort] ?? 8192,
              },
            }
          : {};

      const response = await client.models.generateContent({
        model: params.model,
        contents: messages,
        config: {
          ...(systemInstruction ? { systemInstruction } : {}),
          temperature: params.temperature,
          maxOutputTokens: params.maxTokens,
          ...thinkingConfig,
          ...(signal ? { abortSignal: signal } : {}),
        },
      });

      let text = "";
      let reasoning = "";
      const candidate = response.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.thought) {
            reasoning += part.text ?? "";
          } else if (part.text) {
            text += part.text;
          }
        }
      }

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
        finishReason: normalizeFinishReason(candidate?.finishReason),
      };
    },

    async *stream(apiKey, params, signal) {
      const client = createClient(config, apiKey);
      const { systemInstruction, messages } = extractSystemMessages(
        params.messages,
      );

      const thinkingConfig =
        params.reasoning && params.reasoning.effort !== "none"
          ? {
              thinkingConfig: {
                thinkingBudget: BUDGET_MAP[params.reasoning.effort] ?? 8192,
              },
            }
          : {};

      const stream = await client.models.generateContentStream({
        model: params.model,
        contents: messages,
        config: {
          ...(systemInstruction ? { systemInstruction } : {}),
          temperature: params.temperature,
          maxOutputTokens: params.maxTokens,
          ...thinkingConfig,
          ...(signal ? { abortSignal: signal } : {}),
        },
      });

      for await (const response of stream) {
        const candidate = response.candidates?.[0];
        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.thought) {
              if (part.text) {
                yield { type: "reasoning" as const, text: part.text };
              }
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
