import { GoogleGenAI } from "@google/genai";
import { match, P } from "ts-pattern";
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
  toAiUsage,
} from "./helpers";
import type { CompletionParams, ProviderAdapter } from "./types";

interface GoogleAdapterConfig {
  mode: "api-key" | "vertex";
}

function normalizeFinishReason(raw: string | null | undefined): FinishReason {
  return match(raw)
    .with("STOP", (): FinishReason => "stop")
    .with("MAX_TOKENS", (): FinishReason => "length")
    .with(P.union("SAFETY", "BLOCKLIST"), (): FinishReason => "content_filter")
    .with(P.union(null, undefined, ""), (): FinishReason => "stop")
    .otherwise((): FinishReason => "unknown");
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

/**
 * Google's `functionResponse.response` must be an object. Tool results are
 * always JSON-encoded (see `toolResultContent`), but fall back to wrapping
 * raw text rather than letting `JSON.parse` throw on malformed input.
 */
function toFunctionResponse(text: string): Record<string, unknown> {
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed !== null && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : { result: parsed };
  } catch {
    return { result: text };
  }
}

function extractSystemMessages(messages: AiMessage[]): ExtractedMessages {
  const systemParts: string[] = [];
  const nonSystemMessages: GoogleMessage[] = [];
  // Google's functionResponse identifies the call by function name, not by
  // id — track each tool call's name by its id as assistant messages emit
  // them so the later tool-result message can look it up.
  const toolCallNames = new Map<string, string>();

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
      const name =
        (msg.toolCallId && toolCallNames.get(msg.toolCallId)) ?? "unknown";
      const responseText = extractTextContent(msg.content).text;
      nonSystemMessages.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name,
              response: toFunctionResponse(responseText),
            },
          },
        ],
      });
    } else if (msg.role === "assistant" && msg.toolCalls?.length) {
      // Assistant message with function calls
      const parts: GooglePart[] = [];
      const text = extractTextContent(msg.content).text;
      if (text) {
        parts.push({ text });
      }
      for (const tc of msg.toolCalls) {
        toolCallNames.set(tc.id, tc.name);
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
              id: generateToolUseId(),
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
          ? toAiUsage({
              promptTokens: response.usageMetadata.promptTokenCount ?? 0,
              completionTokens:
                response.usageMetadata.candidatesTokenCount ?? 0,
              totalTokens: response.usageMetadata.totalTokenCount ?? 0,
            })
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

      // Capture usage and the terminating finish reason — Google streams
      // usageMetadata on every chunk (running totals) and finishReason only on
      // the final candidate. Emit `stop` once after the stream drains so the
      // attached usage reflects the run-final values.
      let finalFinishReason: string | null = null;
      let finalUsage: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      } | null = null;

      for await (const response of stream) {
        if (response.usageMetadata) {
          finalUsage = response.usageMetadata;
        }
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
                id: generateToolUseId(),
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
        if (candidate?.finishReason && !finalFinishReason) {
          finalFinishReason = candidate.finishReason;
        }
      }

      if (finalFinishReason) {
        yield {
          type: "stop" as const,
          finishReason: normalizeFinishReason(finalFinishReason),
          ...(finalUsage
            ? {
                usage: toAiUsage({
                  promptTokens: finalUsage.promptTokenCount ?? 0,
                  completionTokens: finalUsage.candidatesTokenCount ?? 0,
                  totalTokens: finalUsage.totalTokenCount ?? 0,
                }),
              }
            : {}),
        };
      }
    },
  };
}
