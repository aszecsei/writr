export type AiTool =
  | "generate-prose"
  | "review-text"
  | "suggest-edits"
  | "character-dialogue"
  | "brainstorm"
  | "summarize";

export interface CacheControl {
  type: "ephemeral";
}

export interface TextContentPart {
  type: "text";
  text: string;
  cache_control?: CacheControl;
}

export type ContentPart = TextContentPart;

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

import type {
  Chapter,
  Character,
  CharacterRelationship,
  Location,
  OutlineCard,
  OutlineColumn,
  ReasoningEffort,
  StyleGuideEntry,
  TimelineEvent,
  WorldbuildingDoc,
} from "@/db/schemas";

export type { ReasoningEffort };

export interface AiContext {
  projectTitle: string;
  genre: string;
  characters: Character[];
  locations: Location[];
  styleGuide: StyleGuideEntry[];
  timelineEvents: TimelineEvent[];
  worldbuildingDocs: WorldbuildingDoc[];
  relationships: CharacterRelationship[];
  outlineColumns: OutlineColumn[];
  outlineCards: OutlineCard[];
  chapters: Chapter[];
  currentChapterTitle?: string;
  currentChapterContent?: string;
  selectedText?: string;
}

export interface AiResponse {
  content: string;
  reasoning?: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AiStreamChunk {
  type: "reasoning" | "content";
  text: string;
}
