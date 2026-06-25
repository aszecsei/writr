import { describe, expect, it } from "vitest";
import type { ToolCallEntry } from "@/lib/ai/tool-calling";
import { makeNestedPanelAccessor } from "./panelAccessor";
import type { ChatMessage, ChatMessageId, ToolChatMessage } from "./types";

function id(s: string): ChatMessageId {
  return s as ChatMessageId;
}

function parentDelegateMessage(): ToolChatMessage {
  return {
    id: id("delegate_call"),
    role: "tool",
    toolCallId: "call_delegate",
    toolName: "delegate",
    displayName: "Delegate to Sub-agent",
    input: { agent: "Reader", prompt: "Summarize chapter one." },
    status: "approved",
    createdAt: "2026-05-08T00:00:00Z",
  };
}

function setup() {
  let messages: ChatMessage[] = [parentDelegateMessage()];
  const setMessages = (
    updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => {
    messages =
      typeof updater === "function"
        ? (updater as (prev: ChatMessage[]) => ChatMessage[])(messages)
        : updater;
  };
  const accessor = makeNestedPanelAccessor({
    setMessages,
    parentToolMessageId: id("delegate_call"),
    seedPrompt: "Summarize chapter one.",
    awaitToolApproval: async () => true,
  });
  const nested = (): ChatMessage[] => {
    const parent = messages.find(
      (m): m is ToolChatMessage => m.id === id("delegate_call"),
    );
    return parent?.nestedMessages ?? [];
  };
  return { accessor, nested };
}

function toolEntry(overrides: Partial<ToolCallEntry> = {}): ToolCallEntry {
  return {
    id: "call_1",
    toolName: "read_chapter",
    displayName: "read_chapter",
    input: { id: "ch1" },
    status: "approved",
    ...overrides,
  };
}

describe("nested panel accessor", () => {
  it("seeds its buffer with the delegate prompt", () => {
    const { accessor } = setup();
    expect(accessor.getMessages()).toEqual([
      { role: "user", content: "Summarize chapter one." },
    ]);
  });

  it("renders the sub-agent transcript inside the parent's nestedMessages", () => {
    const { accessor, nested } = setup();

    const turnId = accessor.startAssistantTurn({ iteration: 1 });
    accessor.appendChunk(turnId, { type: "content", text: "Reading…" });

    // The draft lands under the parent delegate message, not at the top level.
    expect(nested()).toHaveLength(1);
    expect(nested()[0]).toMatchObject({
      role: "assistant",
      content: "Reading…",
    });
  });

  it("commits paired assistant + tool rows to its own buffer", () => {
    const { accessor } = setup();

    const turnId = accessor.startAssistantTurn({ iteration: 1 });
    accessor.appendChunk(turnId, { type: "content", text: "fetching" });
    accessor.finalizeAssistantTurn(turnId, {
      durationMs: 10,
      finishReason: "tool_use",
      toolCallRefs: [{ id: "call_1", name: "read_chapter", arguments: {} }],
    });
    const [toolMsgId] = accessor.appendPendingToolMessages(turnId, [
      toolEntry({ id: "call_1", status: "approved" }),
    ]);
    accessor.updateToolMessage(toolMsgId, {
      status: "executed",
      result: { success: true, message: "chapter one text" },
    });

    const wire = accessor.getMessages();
    expect(wire.map((m) => m.role)).toEqual(["user", "assistant", "tool"]);
    expect(wire[1]).toMatchObject({
      role: "assistant",
      toolCalls: [{ id: "call_1", name: "read_chapter", arguments: {} }],
    });
    expect(wire[2].toolCallId).toBe("call_1");
  });

  it("removes an in-progress nested turn without committing it", () => {
    const { accessor, nested } = setup();

    const turnId = accessor.startAssistantTurn({ iteration: 1 });
    accessor.appendChunk(turnId, { type: "content", text: "partial" });
    accessor.removeAssistantTurn(turnId);

    expect(nested()).toHaveLength(0);
    expect(accessor.getMessages()).toEqual([
      { role: "user", content: "Summarize chapter one." },
    ]);
  });
});
