import type { AiResponse, AiSettings } from "./types";

/**
 * One-shot helper for non-conversational image-description prompts. Used by
 * the bible's image-attachment dialog to auto-generate alt text. Bypasses
 * the agent runner entirely — no project context, no tools, no streaming.
 */
export async function describeImage(
  imageUrl: string,
  settings: Pick<AiSettings, "apiKey" | "model" | "provider">,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
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
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const upstreamMessage =
      typeof error.upstream?.metadata === "object" && error.upstream.metadata
        ? ((error.upstream.metadata as { raw?: string; reason?: string }).raw ??
          (error.upstream.metadata as { reason?: string }).reason)
        : undefined;
    const message =
      upstreamMessage ??
      error.upstream?.message ??
      error.details ??
      error.error ??
      "AI request failed";
    throw new Error(message);
  }

  const data: AiResponse = await response.json();
  return data.content;
}
