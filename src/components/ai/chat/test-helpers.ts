import type {
  AssistantChatMessage,
  ChatMessage,
  ChatMessageId,
  ToolChatMessage,
  UserChatMessage,
} from "./types";

export function id(s: string): ChatMessageId {
  return s as ChatMessageId;
}

export function userMsg(
  overrides: Partial<UserChatMessage> = {},
): UserChatMessage {
  return {
    id: id("u1"),
    role: "user",
    content: "hello",
    createdAt: "2026-05-07T00:00:00Z",
    ...overrides,
  };
}

export function assistantMsg(
  overrides: Partial<AssistantChatMessage> = {},
): AssistantChatMessage {
  return {
    id: id("a1"),
    role: "assistant",
    content: "hi back",
    createdAt: "2026-05-07T00:00:01Z",
    ...overrides,
  };
}

export function toolMsg(
  overrides: Partial<ToolChatMessage> = {},
): ToolChatMessage {
  return {
    id: id("t1"),
    role: "tool",
    toolCallId: "call_1",
    toolName: "list",
    displayName: "list",
    input: { category: "character" },
    status: "executed",
    result: { success: true, message: "ok" },
    createdAt: "2026-05-07T00:00:02Z",
    ...overrides,
  };
}

/**
 * Minimal `Dispatch<SetStateAction<ChatMessage[]>>` shim against a plain
 * in-memory array — mirrors React's functional-updater setState contract so
 * accessor tests can drive `setMessages` without mounting a component.
 */
export function makeSetMessages(initial: ChatMessage[]) {
  let messages = [...initial];
  const setMessages = (
    updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => {
    messages =
      typeof updater === "function"
        ? (updater as (prev: ChatMessage[]) => ChatMessage[])(messages)
        : updater;
  };
  return { setMessages, getMessages: () => messages };
}
