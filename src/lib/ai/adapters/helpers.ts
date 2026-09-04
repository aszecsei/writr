import type { AiUsage, CacheControl, ContentPart } from "../types";

interface ParsedImageDataUrl {
  mimeType: string;
  data: string;
}

/**
 * Coarsens a `ReasoningEffort` down to the smaller scale a couple of
 * providers use for reasoning-adjacent knobs: Anthropic's Claude 4.6
 * `output_config.effort` and OpenRouter's `verbosity` workaround for the same
 * model family. Shared so the two adapters can't drift.
 */
export const REASONING_EFFORT_SCALE: Record<string, string> = {
  xhigh: "max",
  high: "high",
  medium: "medium",
  low: "low",
  minimal: "low",
};

export interface ExtractedTextContent {
  text: string;
  cacheControl?: CacheControl;
}

/**
 * Collapse a message's content into plain text plus an optional cache marker.
 *
 * `withTrailingCacheControl` wraps the most recent history message's string
 * content into a `[{type:"text", text, cache_control}]` array so prompt caching
 * spans tool-calling iterations. Provider adapters converting tool/assistant
 * messages back into provider-specific shapes must not check
 * `typeof content === "string"` and drop the array form, or the most recent
 * tool result goes missing on every follow-up turn.
 *
 * Use this helper anywhere an adapter needs a plain-text fallback for
 * non-string content. Concatenates all text parts and surfaces the first
 * `cache_control` so callers can re-attach it where the wire format allows
 * (e.g. Anthropic `tool_result` blocks).
 */
export function extractTextContent(
  content: string | ContentPart[],
): ExtractedTextContent {
  if (typeof content === "string") {
    return { text: content };
  }
  let text = "";
  let cacheControl: CacheControl | undefined;
  for (const part of content) {
    if (part.type === "text") {
      text += part.text;
      if (!cacheControl && part.cache_control) {
        cacheControl = part.cache_control;
      }
    }
  }
  return { text, cacheControl };
}

/**
 * Parses a base64-encoded image data URL.
 * Returns null for non-data URLs or unsupported formats.
 */
export function parseBase64ImageDataUrl(
  url: string,
): ParsedImageDataUrl | null {
  const match = url.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

/**
 * Generate a tool_use id we own end-to-end. The upstream provider's id has
 * no meaning to us once it leaves the response — the assistant message and
 * the matching tool_result on the next turn are both constructed by us, so
 * we just need ids that are non-empty and unique within an assistant
 * message. Some providers (notably OpenRouter relaying Anthropic via Azure)
 * occasionally drop or repeat ids in streaming deltas, which then 400s with
 * `tool_use ids must be unique` on the next turn.
 */
export function generateToolUseId(): string {
  return `call_${crypto.randomUUID()}`;
}

/**
 * Build an `AiUsage` object. `totalTokens` defaults to `promptTokens +
 * completionTokens` (Anthropic reports base input tokens separately from
 * cache tokens, so callers pre-sum them into `promptTokens`); pass it
 * explicitly when the provider reports its own total that isn't a plain sum
 * of the two (e.g. Google's total also covers thinking tokens). Cache fields
 * are included only when positive.
 */
export function toAiUsage(input: {
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}): AiUsage {
  const {
    promptTokens,
    completionTokens,
    totalTokens = promptTokens + completionTokens,
    cacheCreationTokens,
    cacheReadTokens,
  } = input;
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    ...(cacheCreationTokens && cacheCreationTokens > 0
      ? { cache_creation_tokens: cacheCreationTokens }
      : {}),
    ...(cacheReadTokens && cacheReadTokens > 0
      ? { cache_read_tokens: cacheReadTokens }
      : {}),
  };
}
