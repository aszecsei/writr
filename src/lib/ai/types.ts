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

export interface AiContext {
  projectTitle: string;
  genre: string;
  characters: Array<{ name: string; role: string; description: string }>;
  locations: Array<{ name: string; description: string }>;
  styleGuide: Array<{ title: string; content: string }>;
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
