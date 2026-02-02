import { buildMessages } from "./prompts";
import type { AiContext, AiMessage, AiResponse, AiTool } from "./types";

interface AiSettings {
  apiKey: string;
  model: string;
}

function buildRequestBody(
  tool: AiTool,
  userPrompt: string,
  context: AiContext,
  settings: AiSettings,
  stream: boolean,
  history: AiMessage[] = [],
) {
  return {
    apiKey: settings.apiKey,
    model: settings.model,
    messages: buildMessages(tool, userPrompt, context, history),
    temperature: tool === "generate-prose" ? 1.0 : 0.5,
    max_tokens: 24 * 1024,
    stream,
  };
}

async function fetchAi(body: ReturnType<typeof buildRequestBody>) {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details ?? error.error ?? "AI request failed");
  }

  return response;
}

export async function callAi(
  tool: AiTool,
  userPrompt: string,
  context: AiContext,
  settings: AiSettings,
  history: AiMessage[] = [],
): Promise<AiResponse> {
  const response = await fetchAi(
    buildRequestBody(tool, userPrompt, context, settings, false, history),
  );
  const data = await response.json();

  return {
    content: data.choices[0].message.content,
    model: data.model,
    usage: data.usage,
  };
}

export async function* streamAi(
  tool: AiTool,
  userPrompt: string,
  context: AiContext,
  settings: AiSettings,
  history: AiMessage[] = [],
): AsyncGenerator<string> {
  const response = await fetchAi(
    buildRequestBody(tool, userPrompt, context, settings, true, history),
  );

  if (!response.body) {
    throw new Error("No response body for streaming request");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
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
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // Skip malformed chunks
      }
    }
  }
}
