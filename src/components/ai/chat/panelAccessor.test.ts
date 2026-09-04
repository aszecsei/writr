import type { MutableRefObject } from "react";
import { describe, expect, it } from "vitest";
import type { ToolCallEntry } from "@/lib/ai/tool-calling";
import { makeAiPanelAccessor } from "./panelAccessor";
import { makeSetMessages, userMsg } from "./test-helpers";
import type { ChatMessage } from "./types";

function makeAccessor(initial: ChatMessage[]) {
  const { setMessages, getMessages } = makeSetMessages(initial);
  const messagesRef = {
    get current() {
      return getMessages();
    },
    set current(next: ChatMessage[]) {
      setMessages(next);
    },
  } as MutableRefObject<ChatMessage[]>;

  // The accessor's React state mirror is exercised by setMessages above —
  // tests inspect the buffer via getMessages, and the React-state mirror via
  // `messagesRef.current` directly.
  const accessor = makeAiPanelAccessor({
    messagesRef,
    setMessages,
    awaitToolApproval: async () => true,
  });

  return { accessor, getRendered: () => messagesRef.current };
}

function makeToolEntry(overrides: Partial<ToolCallEntry> = {}): ToolCallEntry {
  return {
    id: "call_1",
    toolName: "list",
    displayName: "list",
    input: { category: "character" },
    status: "approved",
    ...overrides,
  };
}

describe("panelAccessor.getMessages — wire-format buffer", () => {
  it("returns the seeded user message and excludes an unfinalized assistant draft", () => {
    const { accessor } = makeAccessor([userMsg({ content: "hello" })]);

    accessor.startAssistantTurn({ iteration: 1 });

    const wire = accessor.getMessages();
    expect(wire).toHaveLength(1);
    expect(wire[0]).toEqual({ role: "user", content: "hello" });
  });

  it("does not commit content streamed via appendChunk until finalize runs", () => {
    const { accessor } = makeAccessor([userMsg({ content: "go" })]);

    const turnId = accessor.startAssistantTurn({ iteration: 1 });
    accessor.appendChunk(turnId, { type: "content", text: "thinking..." });

    // Buffer still only has the user message — the in-progress assistant
    // turn must not leak into the wire format.
    const wire = accessor.getMessages();
    expect(wire).toHaveLength(1);
    expect(wire[0].role).toBe("user");
  });

  it("commits the assistant turn (with toolCalls) to the buffer on finalize", () => {
    const { accessor } = makeAccessor([userMsg({ content: "research" })]);

    const turnId = accessor.startAssistantTurn({ iteration: 1 });
    accessor.appendChunk(turnId, { type: "content", text: "calling list" });
    accessor.finalizeAssistantTurn(turnId, {
      durationMs: 200,
      finishReason: "tool_use",
      toolCallRefs: [
        { id: "call_1", name: "list", arguments: { category: "character" } },
      ],
    });

    const wire = accessor.getMessages();
    expect(wire).toHaveLength(2);
    expect(wire[1]).toEqual({
      role: "assistant",
      content: "calling list",
      toolCalls: [
        { id: "call_1", name: "list", arguments: { category: "character" } },
      ],
    });
  });

  it("commits a tool row to the buffer only when the tool reaches a terminal status", () => {
    const { accessor } = makeAccessor([userMsg({ content: "research" })]);

    const turnId = accessor.startAssistantTurn({ iteration: 1 });
    accessor.finalizeAssistantTurn(turnId, {
      durationMs: 100,
      finishReason: "tool_use",
      toolCallRefs: [
        { id: "call_1", name: "list", arguments: { category: "character" } },
      ],
    });

    const [toolMsgId] = accessor.appendPendingToolMessages(turnId, [
      makeToolEntry({ id: "call_1", status: "approved" }),
    ]);

    // Pending tool entry — buffer must not include a tool row yet.
    expect(accessor.getMessages().map((m) => m.role)).toEqual([
      "user",
      "assistant",
    ]);

    accessor.updateToolMessage(toolMsgId, {
      status: "executed",
      result: { success: true, message: "found 3 characters" },
    });

    const wire = accessor.getMessages();
    expect(wire.map((m) => m.role)).toEqual(["user", "assistant", "tool"]);
    expect(wire[2].toolCallId).toBe("call_1");
    const parsed = JSON.parse(wire[2].content as string);
    expect(parsed).toEqual({
      success: true,
      message: "found 3 characters",
    });
  });

  it("emits the denied sentinel when a tool is denied by the user", () => {
    const { accessor } = makeAccessor([userMsg({ content: "research" })]);

    const turnId = accessor.startAssistantTurn({ iteration: 1 });
    accessor.finalizeAssistantTurn(turnId, {
      durationMs: 100,
      finishReason: "tool_use",
      toolCallRefs: [{ id: "call_x", name: "propose_edit", arguments: {} }],
    });
    const [toolMsgId] = accessor.appendPendingToolMessages(turnId, [
      makeToolEntry({ id: "call_x", status: "pending" }),
    ]);

    accessor.updateToolMessage(toolMsgId, { status: "denied" });

    const wire = accessor.getMessages();
    expect(wire[wire.length - 1].toolCallId).toBe("call_x");
    const parsed = JSON.parse(wire[wire.length - 1].content as string);
    expect(parsed).toEqual({ success: false, message: "Denied by user" });
  });

  it("does not double-commit a tool row across multiple terminal updates", () => {
    const { accessor } = makeAccessor([userMsg({ content: "go" })]);

    const turnId = accessor.startAssistantTurn({ iteration: 1 });
    accessor.finalizeAssistantTurn(turnId, {
      durationMs: 50,
      finishReason: "tool_use",
      toolCallRefs: [{ id: "call_1", name: "list", arguments: {} }],
    });
    const [toolMsgId] = accessor.appendPendingToolMessages(turnId, [
      makeToolEntry({ id: "call_1", status: "approved" }),
    ]);

    accessor.updateToolMessage(toolMsgId, {
      status: "executed",
      result: { success: true, message: "ok" },
    });
    // A spurious follow-up update (e.g. a no-op patch) must not append a
    // duplicate tool row.
    accessor.updateToolMessage(toolMsgId, {
      result: { success: true, message: "ok" },
    });

    const toolRows = accessor.getMessages().filter((m) => m.role === "tool");
    expect(toolRows).toHaveLength(1);
  });

  it("does not commit anything to the buffer when an in-progress turn is removed", () => {
    const { accessor, getRendered } = makeAccessor([
      userMsg({ content: "hello" }),
    ]);

    const turnId = accessor.startAssistantTurn({ iteration: 1 });
    accessor.appendChunk(turnId, { type: "content", text: "partial" });
    accessor.removeAssistantTurn(turnId);

    expect(accessor.getMessages()).toEqual([
      { role: "user", content: "hello" },
    ]);
    // The React-state mirror also drops the draft.
    expect(getRendered().some((m) => m.id === turnId)).toBe(false);
  });
});
