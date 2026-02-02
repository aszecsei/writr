import { buildMessages } from "./prompts";
import type { AiContext, AiResponse, AiTool } from "./types";

export async function callAi(
  tool: AiTool,
  userPrompt: string,
  context: AiContext,
  settings: { apiKey: string; model: string },
): Promise<AiResponse> {
  const messages = buildMessages(tool, userPrompt, context);

  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: settings.apiKey,
      model: settings.model,
      messages,
      temperature: tool === "generate-prose" ? 1.0 : 0.5,
      max_tokens: 24 * 1024,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details ?? error.error ?? "AI request failed");
  }

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
  settings: { apiKey: string; model: string },
): AsyncGenerator<string> {
  const messages = buildMessages(tool, userPrompt, context);

  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: settings.apiKey,
      model: settings.model,
      messages,
      temperature: 0.8,
      max_tokens: 4096,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error("Streaming request failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

    for (const line of lines) {
      const json = line.slice(6);
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
