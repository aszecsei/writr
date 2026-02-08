import { buildMessages } from "./prompts";
import type {
  AiContext,
  AiMessage,
  AiProvider,
  AiResponse,
  AiStreamChunk,
  AiToolId,
  FinishReason,
  ReasoningEffort,
} from "./types";

interface AiSettings {
  apiKey: string;
  model: string;
  provider: AiProvider;
  reasoningEffort?: ReasoningEffort;
  postChatInstructions?: string;
  postChatInstructionsDepth?: number;
  assistantPrefill?: string;
  customSystemPrompt?: string | null;
  toolPromptOverride?: string;
  images?: { url: string }[];
}

function buildRequestBody(
  tool: AiToolId,
  userPrompt: string,
  context: AiContext,
  settings: AiSettings,
  stream: boolean,
  history: AiMessage[] = [],
) {
  const body: Record<string, unknown> = {
    apiKey: settings.apiKey,
    model: settings.model,
    provider: settings.provider,
    messages: buildMessages(tool, userPrompt, context, history, {
      postChatInstructions: settings.postChatInstructions,
      postChatInstructionsDepth: settings.postChatInstructionsDepth,
      assistantPrefill: settings.assistantPrefill,
      customSystemPrompt: settings.customSystemPrompt,
      toolPromptOverride: settings.toolPromptOverride,
      images: settings.images,
    }),
    temperature: tool === "generate-prose" ? 1.0 : 0.5,
    max_tokens: 24 * 1024,
    stream,
  };

  if (settings.reasoningEffort && settings.reasoningEffort !== "none") {
    body.reasoning = { effort: settings.reasoningEffort };
  }

  return body;
}

async function fetchAi(body: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details ?? error.error ?? "AI request failed");
  }

  return response;
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

export async function callAi(
  tool: AiToolId,
  userPrompt: string,
  context: AiContext,
  settings: AiSettings,
  history: AiMessage[] = [],
  signal?: AbortSignal,
): Promise<AiResponse> {
  const response = await fetchAi(
    buildRequestBody(tool, userPrompt, context, settings, false, history),
    signal,
  );
  const data = await response.json();

  return {
    content: data.choices[0].message.content,
    reasoning: data.choices[0].message.reasoning,
    model: data.model,
    usage: data.usage,
    finishReason: normalizeFinishReason(data.choices[0].finish_reason),
  };
}

export async function* streamAi(
  tool: AiToolId,
  userPrompt: string,
  context: AiContext,
  settings: AiSettings,
  history: AiMessage[] = [],
  signal?: AbortSignal,
): AsyncGenerator<AiStreamChunk> {
  const response = await fetchAi(
    buildRequestBody(tool, userPrompt, context, settings, true, history),
    signal,
  );

  if (!response.body) {
    throw new Error("No response body for streaming request");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    if (signal?.aborted) break;
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      const json = trimmed.slice(6);
      if (json === "[DONE]") return;

      try {
        const parsed = JSON.parse(json);
        const choice = parsed.choices?.[0];
        const delta = choice?.delta;

        if (delta) {
          // Reasoning tokens from OpenRouter
          const reasoningDetails = delta.reasoning_details;
          if (Array.isArray(reasoningDetails)) {
            for (const detail of reasoningDetails) {
              if (detail?.text) {
                yield { type: "reasoning", text: detail.text };
              }
            }
          }
          // Fallback: handle reasoning as a direct string field
          else if (delta.reasoning) {
            yield { type: "reasoning", text: delta.reasoning };
          }

          if (delta.content) {
            yield { type: "content", text: delta.content };
          }
        }

        if (choice?.finish_reason) {
          yield {
            type: "stop",
            finishReason: normalizeFinishReason(choice.finish_reason),
          };
        }
      } catch (error) {
        // Log malformed chunks in development for debugging
        if (process.env.NODE_ENV === "development") {
          console.warn("[AI Stream] Skipping malformed chunk:", json, error);
        }
      }
    }
  }
}
