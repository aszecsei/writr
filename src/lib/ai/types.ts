export type AiTool =
  | "generate-prose"
  | "review-text"
  | "suggest-edits"
  | "character-dialogue"
  | "brainstorm"
  | "summarize";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

import type {
  Character,
  CharacterRelationship,
  Location,
  StyleGuideEntry,
  TimelineEvent,
  WorldbuildingDoc,
} from "@/db/schemas";

export interface AiContext {
  projectTitle: string;
  genre: string;
  characters: Character[];
  locations: Location[];
  styleGuide: StyleGuideEntry[];
  timelineEvents: TimelineEvent[];
  worldbuildingDocs: WorldbuildingDoc[];
  relationships: CharacterRelationship[];
  currentChapterTitle?: string;
  currentChapterContent?: string;
  selectedText?: string;
}

export interface AiResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
