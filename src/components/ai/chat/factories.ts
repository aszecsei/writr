import type { ToolCallStatus } from "@/lib/ai/tool-calling";
import type {
  AssistantChatMessage,
  ChatImage,
  ChatMessageId,
  ToolChatMessage,
  UserChatMessage,
} from "./types";

function mintChatMessageId(): ChatMessageId {
  return crypto.randomUUID() as ChatMessageId;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function makeUserMessage(input: {
  content: string;
  selectedText?: string;
  selectedChapterId?: string;
  images?: ChatImage[];
}): UserChatMessage {
  return {
    id: mintChatMessageId(),
    role: "user",
    content: input.content,
    ...(input.selectedText ? { selectedText: input.selectedText } : {}),
    ...(input.selectedChapterId
      ? { selectedChapterId: input.selectedChapterId }
      : {}),
    ...(input.images && input.images.length > 0
      ? { images: input.images }
      : {}),
    createdAt: nowIso(),
  };
}

export function makeEmptyAssistantMessage(input?: {
  capturedPrompt?: AssistantChatMessage["capturedPrompt"];
}): AssistantChatMessage {
  return {
    id: mintChatMessageId(),
    role: "assistant",
    content: "",
    ...(input?.capturedPrompt ? { capturedPrompt: input.capturedPrompt } : {}),
    createdAt: nowIso(),
  };
}

export function makePendingToolMessage(input: {
  toolCallId: string;
  toolName: string;
  displayName: string;
  toolInput: Record<string, unknown>;
  status: ToolCallStatus;
}): ToolChatMessage {
  return {
    id: mintChatMessageId(),
    role: "tool",
    toolCallId: input.toolCallId,
    toolName: input.toolName,
    displayName: input.displayName,
    input: input.toolInput,
    status: input.status,
    createdAt: nowIso(),
  };
}
