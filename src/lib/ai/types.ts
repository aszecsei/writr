export interface CacheControl {
  type: "ephemeral";
}

export interface TextContentPart {
  type: "text";
  text: string;
  cache_control?: CacheControl;
}

export interface ImageUrlContentPart {
  type: "image_url";
  image_url: { url: string };
}

export type ContentPart = TextContentPart | ImageUrlContentPart;

export interface AiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  /** Gemini's opaque `thoughtSignature` for this function call; echoed back on the next request. */
  thoughtSignature?: string;
}

export interface AiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  toolCalls?: AiToolCall[];
  toolCallId?: string;
  /** Signed reasoning blocks of an assistant turn, replayed ahead of its tool calls. */
  thinkingBlocks?: ThinkingBlock[];
}

import type {
  AiProvider,
  Chapter,
  GuardrailEntry,
  ProjectMode,
  ReasoningEffort,
  StyleGuideEntry,
} from "@/db/schemas";

import type { ThinkingBlock } from "./thinking";

export type { ReasoningEffort, ThinkingBlock };

export interface AiContext {
  projectTitle: string;
  projectDescription: string;
  genre: string;
  projectMode?: ProjectMode;
  styleGuide: StyleGuideEntry[];
  guardrails: GuardrailEntry[];
  chapters: Chapter[];
  currentChapterId?: string;
  currentChapterTitle?: string;
  currentChapterContent?: string;
  selectedText?: string;
  /** Retrieval blocks (semantic lore + scenes). Populated by the chat panel. */
  relevantLore?: { title: string; text: string }[];
  pastEvents?: { title: string; text: string }[];
  futureEvents?: { title: string; text: string }[];
}

export type FinishReason =
  | "stop"
  | "length"
  | "content_filter"
  | "tool_use"
  | "unknown";

export interface AiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  /** Tokens written into the prompt cache (a.k.a. "cache creation"). */
  cache_creation_tokens?: number;
  /** Tokens served from the prompt cache (a.k.a. "cache read" / "cache hits"). */
  cache_read_tokens?: number;
}

export interface AiResponse {
  content: string;
  reasoning?: string;
  model: string;
  usage?: AiUsage;
  finishReason?: FinishReason;
  toolCalls?: AiToolCall[];
  thinkingBlocks?: ThinkingBlock[];
}

export type AiStreamChunk =
  | { type: "reasoning"; text: string }
  | { type: "content"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
      thoughtSignature?: string;
    }
  | { type: "thinking_block"; block: ThinkingBlock }
  | { type: "stop"; finishReason: FinishReason; usage?: AiUsage };

/**
 * Minimal settings shape consumed by `client.ts/describeImage` (the only
 * client-side call that doesn't go through the agent runner). All other
 * call paths use `ResolvedAgentModel` from `agents/types.ts`.
 */
export interface AiSettings {
  apiKey: string;
  model: string;
  provider: AiProvider;
}
