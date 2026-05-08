import type {
  AssistantChatMessage,
  ChatImage,
  ChatMessageId,
  ToolCallRef,
  ToolChatMessage,
  ToolChatMessageStatus,
  UserChatMessage,
} from "./types";

export function mintChatMessageId(): ChatMessageId {
  return crypto.randomUUID() as ChatMessageId;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function makeUserMessage(input: {
  content: string;
  selectedText?: string;
  images?: ChatImage[];
}): UserChatMessage {
  return {
    id: mintChatMessageId(),
    role: "user",
    content: input.content,
    ...(input.selectedText ? { selectedText: input.selectedText } : {}),
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
  status: ToolChatMessageStatus;
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

export function toToolCallRef(call: {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}): ToolCallRef {
  return { id: call.id, name: call.name, arguments: call.arguments };
}
