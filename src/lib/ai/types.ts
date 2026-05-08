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
  cache_control?: CacheControl;
}

export type ContentPart = TextContentPart | ImageUrlContentPart;

export interface AiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  toolCalls?: AiToolCall[];
  toolCallId?: string;
}

import type {
  AiProvider,
  Chapter,
  Character,
  CharacterRelationship,
  Location,
  OutlineGridCell,
  OutlineGridColumn,
  OutlineGridRow,
  ProjectMode,
  ReasoningEffort,
  StyleGuideEntry,
  TimelineEvent,
  WorldbuildingDoc,
} from "@/db/schemas";

export type { AiProvider, ReasoningEffort };

export interface AiContext {
  projectTitle: string;
  projectDescription: string;
  genre: string;
  projectMode?: ProjectMode;
  characters: Character[];
  locations: Location[];
  styleGuide: StyleGuideEntry[];
  timelineEvents: TimelineEvent[];
  worldbuildingDocs: WorldbuildingDoc[];
  relationships: CharacterRelationship[];
  outlineGridColumns: OutlineGridColumn[];
  outlineGridRows: OutlineGridRow[];
  outlineGridCells: OutlineGridCell[];
  chapters: Chapter[];
  currentChapterTitle?: string;
  currentChapterContent?: string;
  selectedText?: string;
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
}

export type AiStreamChunk =
  | { type: "reasoning"; text: string }
  | { type: "content"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
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
