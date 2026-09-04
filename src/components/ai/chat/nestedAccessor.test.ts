import { describe, expect, it } from "vitest";
import { makeNestedPanelAccessor } from "./panelAccessor";
import { id, makeSetMessages } from "./test-helpers";
import type { ChatMessage, ToolChatMessage } from "./types";

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
  const { setMessages, getMessages } = makeSetMessages([
    parentDelegateMessage(),
  ]);
  const accessor = makeNestedPanelAccessor({
    setMessages,
    parentToolMessageId: id("delegate_call"),
    seedPrompt: "Summarize chapter one.",
    awaitToolApproval: async () => true,
  });
  const nested = (): ChatMessage[] => {
    const parent = getMessages().find(
      (m): m is ToolChatMessage => m.id === id("delegate_call"),
    );
    return parent?.nestedMessages ?? [];
  };
  return { accessor, nested };
}

describe("nested panel accessor", () => {
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
});
