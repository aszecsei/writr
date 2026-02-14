import { buildMessages } from "./prompts";
import type {
  AiContext,
  AiMessage,
  AiResponse,
  AiSettings,
  AiStreamChunk,
  AiToolId,
} from "./types";

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
  return await response.json();
}

export async function describeImage(
  imageUrl: string,
  settings: Pick<AiSettings, "apiKey" | "model" | "provider">,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetchAi(
    {
      apiKey: settings.apiKey,
      model: settings.model,
      provider: settings.provider,
      messages: [
        {
          role: "system",
          content:
            "Describe the image concisely in 1-2 sentences, suitable for use as alt-text or a caption. Focus on the most visually important details.",
        },
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: imageUrl } }],
        },
      ],
      temperature: 0.3,
      max_tokens: 256,
      stream: false,
    },
    signal,
  );
  const data: AiResponse = await response.json();
  return data.content;
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
        yield JSON.parse(json) as AiStreamChunk;
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[AI Stream] Skipping malformed chunk:", json, error);
        }
      }
    }
  }
}
