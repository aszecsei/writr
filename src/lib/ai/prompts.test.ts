import { describe, expect, it } from "vitest";
import type { Chapter, ChapterId, ProjectId } from "@/db/schemas";
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

function makeChapter(overrides: Partial<Chapter> & { id: ChapterId }): Chapter {
  return {
    id: overrides.id,
    projectId: overrides.projectId ?? ("project-1" as ProjectId),
    title: overrides.title ?? "Untitled",
    order: overrides.order ?? 0,
    content: overrides.content ?? "",
    synopsis: overrides.synopsis ?? "",
    status: overrides.status ?? "draft",
    wordCount: overrides.wordCount ?? 0,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00Z",
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
    const msgs = buildMessages("Write a sonnet", emptyContext());
    const sys = getSystemText(msgs);
    expect(sys).toContain("<task>");
    expect(sys).toContain("Write a sonnet");
    expect(sys).toContain("</task>");
  });

  it("includes the project title in the bible context", () => {
    const msgs = buildMessages("agent prompt", emptyContext());
    const text = getFirstUserText(msgs);
    expect(text).toContain('<novel title="Test Novel"');
  });

  it("uses <screenplay> root tag for screenplay projects", () => {
    const msgs = buildMessages(
      "agent prompt",
      emptyContext({ projectMode: "screenplay" }),
    );
    expect(getFirstUserText(msgs)).toContain('<screenplay title="Test Novel"');
  });

  it("injects the active chapter as a separate user message when set", () => {
    const msgs = buildMessages(
      "agent prompt",
      emptyContext({
        currentChapterTitle: "Chapter 1",
        currentChapterContent: "Once upon a time...",
      }),
    );
    const userMessages = msgs.filter((m) => m.role === "user");
    // [0] = bible context, [1] = chapter (no synthetic user prompt anymore —
    // user messages come in via `history` already wire-formatted).
    expect(userMessages.length).toBeGreaterThanOrEqual(2);
    const chapterMsg = userMessages[1];
    const text =
      typeof chapterMsg.content === "string"
        ? chapterMsg.content
        : (chapterMsg.content as TextContentPart[]).map((p) => p.text).join("");
    expect(text).toContain('<chapter title="Chapter 1">');
    expect(text).toContain("Once upon a time...");
  });

  it("appends history messages verbatim (user content already wire-formatted)", () => {
    const history: AiMessage[] = [
      {
        role: "user",
        content:
          "<selected-text>\nfox\n</selected-text>\n\nrewrite this please",
      },
    ];
    const msgs = buildMessages("agent prompt", emptyContext(), history);
    const last = msgs[msgs.length - 1];
    expect(last.role).toBe("user");
    const text =
      typeof last.content === "string"
        ? last.content
        : (last.content as TextContentPart[]).map((p) => p.text).join("");
    expect(text).toContain("<selected-text>");
    expect(text).toContain("fox");
    expect(text).toContain("rewrite this please");
  });

  it("appends an assistant prefill at the end when provided", () => {
    const msgs = buildMessages("agent prompt", emptyContext(), [], {
      assistantPrefill: "Here's my response:",
    });
    const last = msgs[msgs.length - 1];
    expect(last.role).toBe("assistant");
    expect(last.content).toBe("Here's my response:");
  });

  it("respects customSystemPrompt as the preamble", () => {
    const msgs = buildMessages("agent prompt", emptyContext(), [], {
      customSystemPrompt: "You are a strict editor.",
    });
    const sys = getSystemText(msgs);
    expect(sys.startsWith("You are a strict editor.")).toBe(true);
  });

  it("emits a tool-calling-instructions block when enableToolCalling is on", () => {
    const msgs = buildMessages("agent prompt", emptyContext(), [], {
      enableToolCalling: true,
    });
    expect(getSystemText(msgs)).toContain("<tool-calling-instructions>");
  });

  it("uses the minimal agentic context when tool calling is enabled", () => {
    const msgs = buildMessages(
      "agent prompt",
      emptyContext({ projectDescription: "An epic." }),
      [],
      { enableToolCalling: true },
    );
    const text = getFirstUserText(msgs);
    expect(text).toContain("<description>An epic.</description>");
  });

  it("uses the same minimal context when tool calling is disabled (no full bible dump)", () => {
    const msgs = buildMessages(
      "agent prompt",
      emptyContext({ projectDescription: "An epic." }),
    );
    const text = getFirstUserText(msgs);
    expect(text).toContain("<description>An epic.</description>");
    expect(text).not.toContain("<characters>");
    expect(text).not.toContain("<locations>");
    expect(text).not.toContain("<timeline>");
    expect(text).not.toContain("<worldbuilding>");
    expect(text).not.toContain("<outline>");
    expect(text).not.toContain("<relationships>");
  });

  it("emits a chapter table-of-contents in the project context", () => {
    const msgs = buildMessages(
      "agent prompt",
      emptyContext({
        chapters: [
          makeChapter({
            id: "c1" as ChapterId,
            title: "The Beginning",
            order: 0,
          }),
          makeChapter({
            id: "c2" as ChapterId,
            title: "Rising Action",
            order: 1,
            status: "revised",
            wordCount: 1234,
          }),
        ],
      }),
    );
    const text = getFirstUserText(msgs);
    expect(text).toContain("<table-of-contents>");
    expect(text).toContain('id="c1"');
    expect(text).toContain('title="The Beginning"');
    expect(text).toContain('id="c2"');
    expect(text).toContain('title="Rising Action"');
    expect(text).toContain('status="revised"');
    expect(text).toContain('wordCount="1234"');
  });

  it("injects post-chat instructions into the Nth-last history user message", () => {
    const history: AiMessage[] = [
      { role: "user", content: "first user turn" },
      { role: "assistant", content: "ack" },
      { role: "user", content: "second user turn" },
    ];
    const msgs = buildMessages("agent prompt", emptyContext(), history, {
      postChatInstructions: "Respond in JSON.",
      postChatInstructionsDepth: 1,
    });
    // Depth 1 = the most recent non-synthetic user message.
    const lastUser = [...msgs].reverse().find((m) => m.role === "user");
    const text =
      typeof lastUser?.content === "string"
        ? lastUser.content
        : ((lastUser?.content as TextContentPart[]) ?? [])
            .map((p) => p.text)
            .join("");
    expect(text).toContain("Respond in JSON.");
    expect(text).toContain("second user turn");
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

  it("omits the table-of-contents block when no chapters exist", () => {
    const xml = buildAgenticContext(emptyContext());
    expect(xml).not.toContain("<table-of-contents>");
  });

  it("renders a table-of-contents listing chapter id/title/order", () => {
    const xml = buildAgenticContext(
      emptyContext({
        chapters: [
          makeChapter({ id: "c1" as ChapterId, title: "Opening", order: 0 }),
          makeChapter({ id: "c2" as ChapterId, title: "Climax", order: 1 }),
        ],
      }),
    );
    expect(xml).toContain("<table-of-contents>");
    expect(xml).toContain('<chapter id="c1" order="0" title="Opening"');
    expect(xml).toContain('<chapter id="c2" order="1" title="Climax"');
    expect(xml).toContain("</table-of-contents>");
  });

  it("escapes special characters in chapter titles and ids", () => {
    const xml = buildAgenticContext(
      emptyContext({
        chapters: [
          makeChapter({
            id: "c1" as ChapterId,
            title: 'Quotes "and" ampersands & angles',
            order: 0,
          }),
        ],
      }),
    );
    expect(xml).toContain(
      'title="Quotes &quot;and&quot; ampersands &amp; angles"',
    );
  });
});
