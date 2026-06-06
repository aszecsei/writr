import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageUrlContentPart, TextContentPart } from "@/lib/ai/types";
import { toAiMessages } from "./toAiMessages";
import type {
  AssistantChatMessage,
  ChatMessage,
  ChatMessageId,
  ToolChatMessage,
  UserChatMessage,
} from "./types";

function id(s: string): ChatMessageId {
  return s as ChatMessageId;
}

function userMsg(overrides: Partial<UserChatMessage>): UserChatMessage {
  return {
    id: id("u1"),
    role: "user",
    content: "hello",
    createdAt: "2026-05-07T00:00:00Z",
    ...overrides,
  };
}

function assistantMsg(
  overrides: Partial<AssistantChatMessage>,
): AssistantChatMessage {
  return {
    id: id("a1"),
    role: "assistant",
    content: "hi back",
    createdAt: "2026-05-07T00:00:01Z",
    ...overrides,
  };
}

function toolMsg(overrides: Partial<ToolChatMessage>): ToolChatMessage {
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

describe("toAiMessages", () => {
  it("converts a plain user message to role:'user' string content", () => {
    const out = toAiMessages([userMsg({ content: "hello" })]);
    expect(out).toEqual([{ role: "user", content: "hello" }]);
  });

  it("wraps selectedText into a <selected-text> block on the user message", () => {
    const out = toAiMessages([
      userMsg({ content: "rewrite", selectedText: "the quick brown fox" }),
    ]);
    const text = out[0].content as string;
    expect(text).toContain("<selected-text>");
    expect(text).toContain("the quick brown fox");
    expect(text).toContain("rewrite");
  });

  it("adds the chapter id to the <selected-text> block when set", () => {
    const out = toAiMessages([
      userMsg({
        content: "rewrite",
        selectedText: "the quick brown fox",
        selectedChapterId: "ch-123",
      }),
    ]);
    const text = out[0].content as string;
    expect(text).toContain('<selected-text chapter-id="ch-123">');
  });

  it("escapes a chapter id containing a quote so the attribute is not broken", () => {
    const out = toAiMessages([
      userMsg({
        content: "rewrite",
        selectedText: "fox",
        selectedChapterId: 'a"b&c',
      }),
    ]);
    const text = out[0].content as string;
    expect(text).toContain('chapter-id="a&quot;b&amp;c"');
    expect(text).not.toContain('chapter-id="a"b');
  });

  it("composes images as a multi-part content array", () => {
    const out = toAiMessages([
      userMsg({
        content: "describe",
        images: [{ url: "data:image/png;base64,abc", alt: "a" }],
      }),
    ]);
    const content = out[0].content;
    expect(Array.isArray(content)).toBe(true);
    const parts = content as Array<TextContentPart | ImageUrlContentPart>;
    expect(parts[0]).toEqual({ type: "text", text: "describe" });
    expect(parts[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/png;base64,abc" },
    });
  });

  it("combines selectedText and images on the same user message", () => {
    const out = toAiMessages([
      userMsg({
        content: "cmp",
        selectedText: "fox",
        images: [{ url: "u" }],
      }),
    ]);
    const parts = out[0].content as Array<
      TextContentPart | ImageUrlContentPart
    >;
    const textPart = parts[0] as TextContentPart;
    expect(textPart.text).toContain("<selected-text>");
    expect(textPart.text).toContain("fox");
    expect(textPart.text).toContain("cmp");
    expect((parts[1] as ImageUrlContentPart).image_url.url).toBe("u");
  });

  it("converts an assistant turn with toolCallRefs into role:'assistant' + toolCalls", () => {
    const out = toAiMessages([
      assistantMsg({
        content: "calling tool",
        toolCallRefs: [
          { id: "call_1", name: "list", arguments: { category: "character" } },
        ],
      }),
      toolMsg({
        toolCallId: "call_1",
        status: "executed",
        result: { success: true, message: "ok" },
      }),
    ]);
    expect(out[0]).toEqual({
      role: "assistant",
      content: "calling tool",
      toolCalls: [
        { id: "call_1", name: "list", arguments: { category: "character" } },
      ],
    });
  });

  it("emits role:'tool' rows for executed tool messages, JSON-encoding the result", () => {
    const out = toAiMessages([
      toolMsg({
        status: "executed",
        result: { success: true, message: "found 3 characters" },
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe("tool");
    expect(out[0].toolCallId).toBe("call_1");
    const parsed = JSON.parse(out[0].content as string);
    expect(parsed).toEqual({ success: true, message: "found 3 characters" });
  });

  it("emits a denial sentinel for denied tool messages", () => {
    const out = toAiMessages([
      toolMsg({ status: "denied", result: undefined }),
    ]);
    expect(out).toHaveLength(1);
    const parsed = JSON.parse(out[0].content as string);
    expect(parsed).toEqual({ success: false, message: "Denied by user" });
  });

  it("emits a no-result sentinel for error tool messages without a result", () => {
    const out = toAiMessages([toolMsg({ status: "error", result: undefined })]);
    expect(out).toHaveLength(1);
    const parsed = JSON.parse(out[0].content as string);
    expect(parsed).toEqual({ success: false, message: "No result" });
  });

  it("drops a non-terminal tool message and synthesizes a failure tool_result so the assistant's tool_use id is not orphaned", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const out = toAiMessages([
        assistantMsg({
          content: "asking",
          toolCallRefs: [{ id: "call_1", name: "propose_edit", arguments: {} }],
        }),
        toolMsg({ toolCallId: "call_1", status: "pending", result: undefined }),
      ]);
      expect(out).toHaveLength(2);
      expect(out[0].role).toBe("assistant");
      expect(out[1].role).toBe("tool");
      expect(out[1].toolCallId).toBe("call_1");
      const parsed = JSON.parse(out[1].content as string);
      expect(parsed).toEqual({
        success: false,
        message: "Tool result missing",
      });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("drops a standalone approved tool message with no preceding assistant", () => {
    const out = toAiMessages([
      toolMsg({ status: "approved", result: undefined }),
    ]);
    expect(out).toHaveLength(0);
  });

  describe("orphan tool_use repair", () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it("leaves a matched tool_use + tool_result pair untouched", () => {
      const out = toAiMessages([
        assistantMsg({
          content: "calling",
          toolCallRefs: [
            {
              id: "call_a",
              name: "list",
              arguments: { category: "character" },
            },
          ],
        }),
        toolMsg({
          toolCallId: "call_a",
          status: "executed",
          result: { success: true, message: "ok" },
        }),
      ]);
      expect(out).toHaveLength(2);
      expect(out[1].toolCallId).toBe("call_a");
      const parsed = JSON.parse(out[1].content as string);
      expect(parsed).toEqual({ success: true, message: "ok" });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("synthesizes a failure tool_result when the assistant emits a tool_use with no following tool message at all", () => {
      const out = toAiMessages([
        assistantMsg({
          content: "calling",
          toolCallRefs: [
            { id: "call_a", name: "search_chapter", arguments: {} },
          ],
        }),
      ]);
      expect(out).toHaveLength(2);
      expect(out[1].role).toBe("tool");
      expect(out[1].toolCallId).toBe("call_a");
      const parsed = JSON.parse(out[1].content as string);
      expect(parsed).toEqual({
        success: false,
        message: "Tool result missing",
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain("call_a");
      expect(warnSpy.mock.calls[0][0]).toContain("search_chapter");
    });

    it("synthesizes only the missing ids when the assistant emits multiple tool_use blocks but only some have results", () => {
      const out = toAiMessages([
        assistantMsg({
          content: "batch",
          toolCallRefs: [
            { id: "call_a", name: "list", arguments: {} },
            { id: "call_b", name: "get", arguments: {} },
            { id: "call_c", name: "search_project", arguments: {} },
          ],
        }),
        toolMsg({
          id: id("t_a"),
          toolCallId: "call_a",
          status: "executed",
          result: { success: true, message: "a-ok" },
        }),
        toolMsg({
          id: id("t_c"),
          toolCallId: "call_c",
          status: "executed",
          result: { success: true, message: "c-ok" },
        }),
      ]);
      // Existing rows preserved in order; the missing call_b is synthesized.
      expect(out.map((m) => m.role)).toEqual([
        "assistant",
        "tool",
        "tool",
        "tool",
      ]);
      expect(out[1].toolCallId).toBe("call_a");
      expect(out[2].toolCallId).toBe("call_c");
      expect(out[3].toolCallId).toBe("call_b");
      const parsed = JSON.parse(out[3].content as string);
      expect(parsed).toEqual({
        success: false,
        message: "Tool result missing",
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it("synthesizes a tool_result when the only matching tool message is non-terminal (pending)", () => {
      const out = toAiMessages([
        assistantMsg({
          content: "asking",
          toolCallRefs: [{ id: "call_a", name: "propose_edit", arguments: {} }],
        }),
        toolMsg({
          toolCallId: "call_a",
          status: "pending",
          result: undefined,
        }),
      ]);
      // The pending tool row is dropped; the synthetic row replaces it so
      // the assistant's tool_use id is not orphaned.
      expect(out).toHaveLength(2);
      expect(out[1].role).toBe("tool");
      expect(out[1].toolCallId).toBe("call_a");
      const parsed = JSON.parse(out[1].content as string);
      expect(parsed).toEqual({
        success: false,
        message: "Tool result missing",
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("preserves message order across user / assistant / tool entries", () => {
    const history: ChatMessage[] = [
      userMsg({ id: id("u1"), content: "Write a scene" }),
      assistantMsg({
        id: id("a1"),
        content: "researching",
        toolCallRefs: [
          { id: "call_1", name: "list", arguments: { category: "character" } },
        ],
      }),
      toolMsg({
        id: id("t1"),
        toolCallId: "call_1",
        status: "executed",
        result: { success: true, message: "ok" },
      }),
      assistantMsg({ id: id("a2"), content: "Here is the scene." }),
    ];
    const out = toAiMessages(history);
    expect(out.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "tool",
      "assistant",
    ]);
  });
});
