import { describe, expect, it } from "vitest";
import {
  makeChapter,
  makeCharacter,
  makeLocation,
  makeOutlineGridCell,
  makeOutlineGridColumn,
  makeOutlineGridRow,
  makeRelationship,
  makeStyleGuideEntry,
  makeTimelineEvent,
  makeWorldbuildingDoc,
} from "@/test/helpers";
import {
  buildMessages,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TOOL_INSTRUCTIONS,
} from "./prompts";
import type {
  AiContext,
  AiMessage,
  AiTool,
  AiToolId,
  ContentPart,
} from "./types";

const pid = "00000000-0000-4000-8000-000000000001";

function emptyContext(overrides?: Partial<AiContext>): AiContext {
  return {
    projectTitle: "Test Novel",
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
  return (sys.content as ContentPart[]).map((p) => p.text).join("");
}

/** Extract text from the story bible user message (first user message). */
function getNovelContextText(messages: AiMessage[]): string {
  const userMsgs = messages.filter((m) => m.role === "user");
  if (userMsgs.length === 0) return "";
  const first = userMsgs[0];
  if (typeof first.content === "string") return first.content;
  return (first.content as ContentPart[]).map((p) => p.text).join("");
}

describe("buildMessages", () => {
  describe("novel context in user message", () => {
    it("wraps with <novel> tag including title", () => {
      const msgs = buildMessages("brainstorm", "test", emptyContext());
      const text = getNovelContextText(msgs);
      expect(text).toContain('<novel title="Test Novel"');
      expect(text).toContain("</novel>");
    });

    it("includes genre attribute when set", () => {
      const msgs = buildMessages(
        "brainstorm",
        "test",
        emptyContext({ genre: "fantasy" }),
      );
      const text = getNovelContextText(msgs);
      expect(text).toContain('genre="fantasy"');
    });

    it("omits genre attribute when empty", () => {
      const msgs = buildMessages("brainstorm", "test", emptyContext());
      const text = getNovelContextText(msgs);
      expect(text).not.toContain("genre=");
    });

    it("includes <characters> section only when non-empty", () => {
      const noChars = buildMessages("brainstorm", "test", emptyContext());
      expect(getNovelContextText(noChars)).not.toContain("<characters>");

      const withChars = buildMessages(
        "brainstorm",
        "test",
        emptyContext({
          characters: [makeCharacter({ projectId: pid, name: "Hero" })],
        }),
      );
      expect(getNovelContextText(withChars)).toContain("<characters>");
      expect(getNovelContextText(withChars)).toContain("</characters>");
    });

    it("includes <locations> section only when non-empty", () => {
      const noLocs = buildMessages("brainstorm", "test", emptyContext());
      expect(getNovelContextText(noLocs)).not.toContain("<locations>");

      const withLocs = buildMessages(
        "brainstorm",
        "test",
        emptyContext({
          locations: [makeLocation({ projectId: pid, name: "Town" })],
        }),
      );
      expect(getNovelContextText(withLocs)).toContain("<locations>");
    });

    it("includes <style-guide> section only when non-empty", () => {
      const noSg = buildMessages("brainstorm", "test", emptyContext());
      expect(getNovelContextText(noSg)).not.toContain("<style-guide>");

      const withSg = buildMessages(
        "brainstorm",
        "test",
        emptyContext({
          styleGuide: [
            makeStyleGuideEntry({
              projectId: pid,
              title: "Rule",
              content: "Always...",
            }),
          ],
        }),
      );
      expect(getNovelContextText(withSg)).toContain("<style-guide>");
    });

    it("includes <timeline> section only when non-empty", () => {
      const noTl = buildMessages("brainstorm", "test", emptyContext());
      expect(getNovelContextText(noTl)).not.toContain("<timeline>");

      const withTl = buildMessages(
        "brainstorm",
        "test",
        emptyContext({
          timelineEvents: [
            makeTimelineEvent({ projectId: pid, title: "Event" }),
          ],
        }),
      );
      expect(getNovelContextText(withTl)).toContain("<timeline>");
    });

    it("includes <worldbuilding> section only when non-empty", () => {
      const noWb = buildMessages("brainstorm", "test", emptyContext());
      expect(getNovelContextText(noWb)).not.toContain("<worldbuilding>");

      const withWb = buildMessages(
        "brainstorm",
        "test",
        emptyContext({
          worldbuildingDocs: [
            makeWorldbuildingDoc({ projectId: pid, title: "Lore" }),
          ],
        }),
      );
      expect(getNovelContextText(withWb)).toContain("<worldbuilding>");
    });

    it("includes <outline> section only when columns exist", () => {
      const noOutline = buildMessages("brainstorm", "test", emptyContext());
      expect(getNovelContextText(noOutline)).not.toContain("<outline>");

      const col = makeOutlineGridColumn({ projectId: pid, title: "Act I" });
      const chapter = makeChapter({ projectId: pid, title: "Chapter 1" });
      const row = makeOutlineGridRow({
        projectId: pid,
        linkedChapterId: chapter.id,
      });
      const cell = makeOutlineGridCell({
        projectId: pid,
        rowId: row.id,
        columnId: col.id,
        content: "The hero sets out",
      });
      const withOutline = buildMessages(
        "brainstorm",
        "test",
        emptyContext({
          chapters: [chapter],
          outlineGridColumns: [col],
          outlineGridRows: [row],
          outlineGridCells: [cell],
        }),
      );
      const text = getNovelContextText(withOutline);
      expect(text).toContain("<outline>");
      expect(text).toContain("<column>Act I</column>");
      expect(text).toContain('row label="Chapter 1"');
      expect(text).toContain('chapter="Chapter 1"');
      expect(text).toContain('<cell column="Act I">The hero sets out</cell>');
      expect(text).toContain("</outline>");
    });

    it("includes <relationships> section only when non-empty and valid", () => {
      const noRel = buildMessages("brainstorm", "test", emptyContext());
      expect(getNovelContextText(noRel)).not.toContain("<relationships>");

      const char1 = makeCharacter({ projectId: pid, name: "A" });
      const char2 = makeCharacter({ projectId: pid, name: "B" });
      const withRel = buildMessages(
        "brainstorm",
        "test",
        emptyContext({
          characters: [char1, char2],
          relationships: [
            makeRelationship({
              projectId: pid,
              sourceCharacterId: char1.id,
              targetCharacterId: char2.id,
              type: "sibling",
            }),
          ],
        }),
      );
      expect(getNovelContextText(withRel)).toContain("<relationships>");
    });

    it("does not include novel context in the system message", () => {
      const msgs = buildMessages("brainstorm", "test", emptyContext());
      const text = getSystemText(msgs);
      expect(text).not.toContain("<novel");
      expect(text).not.toContain("</novel>");
    });
  });

  describe("story bible prefill", () => {
    it("includes assistant 'Understood.' after story bible user message", () => {
      const msgs = buildMessages("brainstorm", "test", emptyContext());
      // Story bible user message is at index 1, prefill at index 2
      expect(msgs[1].role).toBe("user");
      expect(msgs[2].role).toBe("assistant");
      expect(msgs[2].content).toBe("Understood.");
    });
  });

  describe("tool instructions", () => {
    const tools: AiTool[] = [
      "generate-prose",
      "review-text",
      "suggest-edits",
      "character-dialogue",
      "brainstorm",
      "summarize",
    ];

    for (const tool of tools) {
      it(`produces <task> block for ${tool}`, () => {
        const msgs = buildMessages(tool, "test", emptyContext());
        const text = getSystemText(msgs);
        expect(text).toContain("<task>");
        expect(text).toContain("</task>");
      });
    }
  });

  describe("chapter context", () => {
    it("inserts chapter message when currentChapterContent is set", () => {
      const ctx = emptyContext({
        currentChapterContent: "Once upon a time...",
        currentChapterTitle: "Chapter 1",
      });
      const msgs = buildMessages("brainstorm", "test", ctx);
      // Chapter message is the second user message (after story bible)
      const userMsgs = msgs.filter(
        (m) =>
          m.role === "user" &&
          typeof m.content !== "string" &&
          Array.isArray(m.content),
      );
      // First is story bible, second is chapter
      expect(userMsgs.length).toBeGreaterThanOrEqual(2);
      const chapterMsg = userMsgs[1];
      const text = (chapterMsg.content as ContentPart[])[0].text;
      expect(text).toContain('<chapter title="Chapter 1">');
      expect(text).toContain("Once upon a time...");
      expect(text).toContain("</chapter>");
    });

    it("uses 'Untitled' when no chapter title", () => {
      const ctx = emptyContext({ currentChapterContent: "text" });
      const msgs = buildMessages("brainstorm", "test", ctx);
      const userMsgs = msgs.filter(
        (m) =>
          m.role === "user" &&
          typeof m.content !== "string" &&
          Array.isArray(m.content),
      );
      const chapterMsg = userMsgs[1];
      const text = (chapterMsg.content as ContentPart[])[0].text;
      expect(text).toContain('<chapter title="Untitled">');
    });

    it("includes assistant 'Understood.' after chapter", () => {
      const ctx = emptyContext({ currentChapterContent: "text" });
      const msgs = buildMessages("brainstorm", "test", ctx);
      // Find the chapter user message, then the next assistant message
      const chapterIdx = msgs.findIndex(
        (m) =>
          m.role === "user" &&
          typeof m.content !== "string" &&
          Array.isArray(m.content) &&
          (m.content as ContentPart[])[0].text.includes("<chapter"),
      );
      expect(chapterIdx).toBeGreaterThan(0);
      expect(msgs[chapterIdx + 1].role).toBe("assistant");
      expect(msgs[chapterIdx + 1].content).toBe("Understood.");
    });

    it("omits chapter message when no chapter content", () => {
      const msgs = buildMessages("brainstorm", "test", emptyContext());
      const userMsgs = msgs.filter((m) => m.role === "user");
      // Story bible + final prompt = 2 user messages
      expect(userMsgs).toHaveLength(2);
    });
  });

  describe("selected text", () => {
    it("wraps in <selected-text> tags before user prompt", () => {
      const ctx = emptyContext({ selectedText: "highlight this" });
      const msgs = buildMessages("brainstorm", "my question", ctx);
      const last = msgs[msgs.length - 1];
      expect(last.role).toBe("user");
      expect(last.content).toContain("<selected-text>");
      expect(last.content).toContain("highlight this");
      expect(last.content).toContain("</selected-text>");
      expect(last.content).toContain("my question");
    });

    it("omits selected text when absent", () => {
      const msgs = buildMessages("brainstorm", "my question", emptyContext());
      const last = msgs[msgs.length - 1];
      expect(last.content).not.toContain("<selected-text>");
      expect(last.content).toBe("my question");
    });
  });

  describe("history", () => {
    it("includes history messages between chapter context and final prompt", () => {
      const history: AiMessage[] = [
        { role: "user", content: "first question" },
        { role: "assistant", content: "first answer" },
      ];
      const ctx = emptyContext({ currentChapterContent: "chapter text" });
      const msgs = buildMessages("brainstorm", "follow up", ctx, history);

      // Find the chapter ack (second "Understood.")
      const chapterAckIdx = msgs.findIndex(
        (m, i) =>
          i > 2 && // Skip story bible prefill at index 2
          m.role === "assistant" &&
          typeof m.content === "string" &&
          m.content === "Understood.",
      );
      const historyStartIdx = msgs.findIndex(
        (m) => m.content === "first question",
      );
      const finalIdx = msgs.findIndex((m) => m.content === "follow up");

      expect(chapterAckIdx).toBeLessThan(historyStartIdx);
      expect(historyStartIdx).toBeLessThan(finalIdx);
    });
  });

  describe("cache control", () => {
    it("sets ephemeral cache_control on story bible user message", () => {
      const msgs = buildMessages("brainstorm", "test", emptyContext());
      // Story bible is the first user message (index 1)
      const novelMsg = msgs[1];
      expect(novelMsg.role).toBe("user");
      const parts = novelMsg.content as ContentPart[];
      expect(parts[0].cache_control).toEqual({ type: "ephemeral" });
    });

    it("sets ephemeral cache_control on chapter content", () => {
      const ctx = emptyContext({ currentChapterContent: "text" });
      const msgs = buildMessages("brainstorm", "test", ctx);
      // Chapter message is the second user message with ContentPart[] content
      const chapterMsg = msgs.find(
        (m) =>
          m.role === "user" &&
          typeof m.content !== "string" &&
          Array.isArray(m.content) &&
          (m.content as ContentPart[])[0].text.includes("<chapter"),
      );
      expect(chapterMsg).toBeDefined();
      expect((chapterMsg?.content as ContentPart[])[0].cache_control).toEqual({
        type: "ephemeral",
      });
    });

    it("system message does not have cache_control", () => {
      const msgs = buildMessages("brainstorm", "test", emptyContext());
      const sys = msgs.find((m) => m.role === "system");
      expect(typeof sys?.content).toBe("string");
    });
  });

  describe("custom system prompt", () => {
    it("uses default system prompt when customSystemPrompt is not provided", () => {
      const msgs = buildMessages("brainstorm", "test", emptyContext());
      const text = getSystemText(msgs);
      expect(text).toContain(DEFAULT_SYSTEM_PROMPT);
    });

    it("uses default system prompt when customSystemPrompt is null", () => {
      const msgs = buildMessages("brainstorm", "test", emptyContext(), [], {
        customSystemPrompt: null,
      });
      const text = getSystemText(msgs);
      expect(text).toContain(DEFAULT_SYSTEM_PROMPT);
    });

    it("replaces system prompt when customSystemPrompt is a string", () => {
      const custom = "You are a sci-fi writing expert.";
      const msgs = buildMessages("brainstorm", "test", emptyContext(), [], {
        customSystemPrompt: custom,
      });
      const text = getSystemText(msgs);
      expect(text).toContain(custom);
      expect(text).not.toContain(DEFAULT_SYSTEM_PROMPT);
    });
  });

  describe("suggest-edits context-aware instruction", () => {
    it("uses selection-focused instruction when selectedText is present", () => {
      const ctx = emptyContext({ selectedText: "some highlighted text" });
      const msgs = buildMessages("suggest-edits", "improve this", ctx);
      const text = getSystemText(msgs);
      expect(text).toContain("selected text");
    });

    it("uses chapter-focused instruction when no selectedText", () => {
      const msgs = buildMessages(
        "suggest-edits",
        "improve this",
        emptyContext(),
      );
      const text = getSystemText(msgs);
      expect(text).toContain("current chapter");
      expect(text).not.toContain("selected text");
    });

    it("toolPromptOverride takes priority over context-aware instruction", () => {
      const override = "My custom suggest-edits instruction.";
      const msgs = buildMessages("suggest-edits", "test", emptyContext(), [], {
        toolPromptOverride: override,
      });
      const text = getSystemText(msgs);
      expect(text).toContain(override);
      expect(text).not.toContain("current chapter");
    });
  });

  describe("tool prompt override", () => {
    it("uses default tool instruction for built-in tools", () => {
      const msgs = buildMessages("brainstorm", "test", emptyContext());
      const text = getSystemText(msgs);
      expect(text).toContain(DEFAULT_TOOL_INSTRUCTIONS.brainstorm);
    });

    it("uses toolPromptOverride when provided", () => {
      const override = "Do something completely custom.";
      const msgs = buildMessages("brainstorm", "test", emptyContext(), [], {
        toolPromptOverride: override,
      });
      const text = getSystemText(msgs);
      expect(text).toContain(override);
      expect(text).not.toContain(DEFAULT_TOOL_INSTRUCTIONS.brainstorm);
    });

    it("uses fallback instruction for unknown tool ids", () => {
      const msgs = buildMessages(
        "custom-tool-uuid" as AiToolId,
        "test",
        emptyContext(),
      );
      const text = getSystemText(msgs);
      expect(text).toContain("Follow the user's instructions.");
    });
  });
});
