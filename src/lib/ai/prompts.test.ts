import { describe, expect, it } from "vitest";
import { buildAgenticContext, buildMessages } from "./prompts";
import type { AiContext, AiMessage, TextContentPart } from "./types";

function emptyContext(overrides?: Partial<AiContext>): AiContext {
  return {
    projectTitle: "Test Novel",
    projectDescription: "",
    genre: "",
    characters: [],
    locations: [],
    styleGuide: [],
    timelineEvents: [],
    worldbuildingDocs: [],
    relationships: [],
    outlineGridColumns: [],
    outlineGridRows: [],
    outlineGridCells: [],
    chapters: [],
    ...overrides,
  };
}

function getSystemText(messages: AiMessage[]): string {
  const sys = messages.find((m) => m.role === "system");
  if (!sys) return "";
  if (typeof sys.content === "string") return sys.content;
  return (sys.content as TextContentPart[]).map((p) => p.text).join("");
}

function getFirstUserText(messages: AiMessage[]): string {
  const userMsg = messages.find((m) => m.role === "user");
  if (!userMsg) return "";
  if (typeof userMsg.content === "string") return userMsg.content;
  return (userMsg.content as TextContentPart[]).map((p) => p.text).join("");
}

describe("buildMessages", () => {
  it("places the agent system prompt inside a <task> block", () => {
    const msgs = buildMessages("Write a sonnet", "go", emptyContext());
    const sys = getSystemText(msgs);
    expect(sys).toContain("<task>");
    expect(sys).toContain("Write a sonnet");
    expect(sys).toContain("</task>");
  });

  it("includes the project title in the bible context", () => {
    const msgs = buildMessages("agent prompt", "user msg", emptyContext());
    const text = getFirstUserText(msgs);
    expect(text).toContain('<novel title="Test Novel"');
  });

  it("uses <screenplay> root tag for screenplay projects", () => {
    const msgs = buildMessages(
      "agent prompt",
      "user msg",
      emptyContext({ projectMode: "screenplay" }),
    );
    expect(getFirstUserText(msgs)).toContain('<screenplay title="Test Novel"');
  });

  it("injects the active chapter as a separate user message when set", () => {
    const msgs = buildMessages(
      "agent prompt",
      "user msg",
      emptyContext({
        currentChapterTitle: "Chapter 1",
        currentChapterContent: "Once upon a time...",
      }),
    );
    const userMessages = msgs.filter((m) => m.role === "user");
    // [0] = bible context, [1] = chapter, [2] = user prompt
    expect(userMessages.length).toBeGreaterThanOrEqual(3);
    const chapterMsg = userMessages[1];
    const text =
      typeof chapterMsg.content === "string"
        ? chapterMsg.content
        : (chapterMsg.content as TextContentPart[]).map((p) => p.text).join("");
    expect(text).toContain('<chapter title="Chapter 1">');
    expect(text).toContain("Once upon a time...");
  });

  it("wraps selected text in a <selected-text> block in the final user message", () => {
    const msgs = buildMessages(
      "agent prompt",
      "rewrite this please",
      emptyContext({ selectedText: "the quick brown fox" }),
    );
    const userMessages = msgs.filter((m) => m.role === "user");
    const last = userMessages[userMessages.length - 1];
    const text =
      typeof last.content === "string"
        ? last.content
        : (last.content as TextContentPart[]).map((p) => p.text).join("");
    expect(text).toContain("<selected-text>");
    expect(text).toContain("the quick brown fox");
    expect(text).toContain("rewrite this please");
  });

  it("appends an assistant prefill at the end when provided", () => {
    const msgs = buildMessages("agent prompt", "user msg", emptyContext(), [], {
      assistantPrefill: "Here's my response:",
    });
    const last = msgs[msgs.length - 1];
    expect(last.role).toBe("assistant");
    expect(last.content).toBe("Here's my response:");
  });

  it("respects customSystemPrompt as the preamble", () => {
    const msgs = buildMessages("agent prompt", "user msg", emptyContext(), [], {
      customSystemPrompt: "You are a strict editor.",
    });
    const sys = getSystemText(msgs);
    expect(sys.startsWith("You are a strict editor.")).toBe(true);
  });

  it("emits a tool-calling-instructions block when enableToolCalling is on", () => {
    const msgs = buildMessages("agent prompt", "user msg", emptyContext(), [], {
      enableToolCalling: true,
    });
    expect(getSystemText(msgs)).toContain("<tool-calling-instructions>");
  });

  it("uses the minimal agentic context when tool calling is enabled", () => {
    const msgs = buildMessages(
      "agent prompt",
      "user msg",
      emptyContext({ projectDescription: "An epic." }),
      [],
      { enableToolCalling: true },
    );
    const text = getFirstUserText(msgs);
    expect(text).toContain("<description>An epic.</description>");
  });

  it("does NOT inject the user prompt when skipUserPrompt is set", () => {
    const msgs = buildMessages(
      "agent prompt",
      "should not appear",
      emptyContext(),
      [],
      { skipUserPrompt: true },
    );
    const userMessages = msgs.filter((m) => m.role === "user");
    for (const m of userMessages) {
      const text =
        typeof m.content === "string"
          ? m.content
          : (m.content as TextContentPart[]).map((p) => p.text).join("");
      expect(text).not.toContain("should not appear");
    }
  });
});

describe("buildAgenticContext", () => {
  it("emits an empty <novel> wrapper when only a title is set", () => {
    const xml = buildAgenticContext(emptyContext());
    expect(xml).toContain('<novel title="Test Novel"');
    expect(xml).toContain("</novel>");
  });

  it("includes description when present", () => {
    const xml = buildAgenticContext(
      emptyContext({ projectDescription: "Cool story." }),
    );
    expect(xml).toContain("<description>Cool story.</description>");
  });
});
