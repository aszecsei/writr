import type { ToolResult } from "@/lib/ai/tool-calling";
import type { AiMessage, FinishReason } from "@/lib/ai/types";

/**
 * Branded ID for chat messages. Stable across the lifetime of a chat session.
 */
export type ChatMessageId = string & { readonly __brand: "ChatMessageId" };

export interface ChatImage {
  url: string;
  alt?: string;
}

/**
 * Wire-format toolCall reference attached to an assistant turn. The runtime
 * details (status, result, displayName) live on the matching ToolChatMessage,
 * found by `id`. Mirrors `AiToolCall` from `@/lib/ai/types`.
 */
export interface ToolCallRef {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface UserChatMessage {
  id: ChatMessageId;
  role: "user";
  content: string;
  /** Editor selection captured at submit time. Wrapped into the wire-format user message by `toAiMessages`. */
  selectedText?: string;
  /** Id of the chapter the selection came from, surfaced on the `<selected-text>` block so the model can correlate it with the TOC. */
  selectedChapterId?: string;
  images?: ChatImage[];
  createdAt: string;
}

export interface AssistantChatMessage {
  id: ChatMessageId;
  role: "assistant";
  content: string;
  reasoning?: string;
  /** Tool-call references the assistant emitted. Each id matches a following ToolChatMessage. */
  toolCallRefs?: ToolCallRef[];
  durationMs?: number;
  finishReason?: FinishReason;
  /**
   * The full assembled prompt sent to the model on iteration 1, captured for
   * the prompt-inspector dialog. Iteration 2+ assistants don't carry this.
   */
  capturedPrompt?: AiMessage[];
  sparkOptions?: boolean;
  sparkCapturedRange?: { from: number; to: number } | null;
  /**
   * Set when this turn came from a `behavior === "panel"` agent (Beta Reader).
   * Drives MessageList to route content through BetaReaderPanelMessage, which
   * parses `<maya>` / `<anton>` / `<joan>` XML blocks into labeled sections.
   */
  panelOutput?: boolean;
  createdAt: string;
}

export type ToolChatMessageStatus =
  | "pending"
  | "approved"
  | "denied"
  | "executed"
  | "error";

export interface ToolChatMessage {
  id: ChatMessageId;
  role: "tool";
  /** Matches the AssistantChatMessage.toolCallRefs[].id this is responding to. */
  toolCallId: string;
  toolName: string;
  displayName: string;
  input: Record<string, unknown>;
  status: ToolChatMessageStatus;
  result?: ToolResult;
  createdAt: string;
}

/**
 * Single canonical message type for the AI chat panel. The shape mirrors
 * `AiMessage` (one entry per role, tool results are flat first-class entries),
 * with optional UI metadata layered on top. Conversion to the wire format
 * (`AiMessage[]`) happens in `toAiMessages.ts`; conversion is lossy for the
 * UI metadata only.
 */
export type ChatMessage =
  | UserChatMessage
  | AssistantChatMessage
  | ToolChatMessage;
