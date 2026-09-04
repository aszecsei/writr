import type { AiMessage, AiResponse, AiSettings } from "./types";

interface OneShotChatBody {
  apiKey: string;
  model: string;
  provider: AiSettings["provider"];
  messages: AiMessage[];
  temperature: number;
  max_tokens: number;
}

/**
 * Shared POST to `/api/ai` for one-shot, non-streaming chat helpers
 * (`describeImage`, `summarizeChapter`): sends the request with
 * `stream: false`, extracts the upstream error message on failure, and
 * returns the response content on success.
 */
async function postChat(
  body: OneShotChatBody,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, stream: false }),
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
  return postChat(
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
    },
    signal,
  );
}

/**
 * One-shot helper that summarizes a single chapter into a concise paragraph.
 * Shared by the chapter-properties dialog's "Generate" button and the AI
 * `summary.get` tool, so the prompt lives in exactly one place. Bypasses the
 * agent runner — no project context, no tools, no streaming.
 */
export async function summarizeChapter(
  title: string,
  content: string,
  settings: Pick<AiSettings, "apiKey" | "model" | "provider">,
  signal?: AbortSignal,
): Promise<string> {
  return postChat(
    {
      apiKey: settings.apiKey,
      model: settings.model,
      provider: settings.provider,
      messages: [
        {
          role: "system",
          content:
            "You produce concise (3-5 sentence) summaries of fiction chapters. Capture the key plot beats, character developments, and any setups/payoffs. No commentary — just the summary.",
        },
        {
          role: "user",
          content: `<chapter title="${title}">\n${content}\n</chapter>`,
        },
      ],
      temperature: 0.3,
      max_tokens: 512,
    },
    signal,
  );
}
