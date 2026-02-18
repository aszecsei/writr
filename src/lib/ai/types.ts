export type BuiltinAiTool =
  | "generate-prose"
  | "review-text"
  | "suggest-edits"
  | "character-dialogue"
  | "brainstorm"
  | "summarize"
  | "consistency-check";

export const BUILTIN_TOOL_IDS: BuiltinAiTool[] = [
  "generate-prose",
  "review-text",
  "suggest-edits",
  "character-dialogue",
  "brainstorm",
  "summarize",
  "consistency-check",
];

/** Tool ID that can be either a built-in tool or a custom tool UUID */
export type AiToolId = BuiltinAiTool | (string & {});

/** @deprecated Use BuiltinAiTool for built-in tools or AiToolId for all tools */
export type AiTool = BuiltinAiTool;

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

export interface AiResponse {
  content: string;
  reasoning?: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
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
  | { type: "stop"; finishReason: FinishReason };

export interface AiSettings {
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
  toolDefinitions?: import("./tool-calling").ToolDefinitionForModel[];
  skipUserPrompt?: boolean;
}
