import { describe, expect, it } from "vitest";
import {
  makeChapter,
  makeCharacter,
  makeLocation,
  makeOutlineCard,
  makeOutlineColumn,
  makeRelationship,
  makeStyleGuideEntry,
  makeTimelineEvent,
  makeWorldbuildingDoc,
} from "@/test/helpers";
import { buildMessages } from "./prompts";
import type { AiContext, AiMessage, AiTool, ContentPart } from "./types";

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
    outlineColumns: [],
    outlineCards: [],
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

describe("buildMessages", () => {
  describe("system message structure", () => {
    it("wraps with <novel> tag including title", () => {
      const msgs = buildMessages("brainstorm", "test", emptyContext());
      const text = getSystemText(msgs);
      expect(text).toContain('<novel title="Test Novel"');
      expect(text).toContain("</novel>");
    });

    it("includes genre attribute when set", () => {
      const msgs = buildMessages(
        "brainstorm",
        "test",
        emptyContext({ genre: "fantasy" }),
      );
      const text = getSystemText(msgs);
      expect(text).toContain('genre="fantasy"');
    });

    it("omits genre attribute when empty", () => {
      const msgs = buildMessages("brainstorm", "test", emptyContext());
      const text = getSystemText(msgs);
      expect(text).not.toContain("genre=");
    });

    it("includes <characters> section only when non-empty", () => {
      const noChars = buildMessages("brainstorm", "test", emptyContext());
      expect(getSystemText(noChars)).not.toContain("<characters>");

      const withChars = buildMessages(
        "brainstorm",
        "test",
        emptyContext({
          characters: [makeCharacter({ projectId: pid, name: "Hero" })],
        }),
      );
      expect(getSystemText(withChars)).toContain("<characters>");
      expect(getSystemText(withChars)).toContain("</characters>");
    });

    it("includes <locations> section only when non-empty", () => {
      const noLocs = buildMessages("brainstorm", "test", emptyContext());
      expect(getSystemText(noLocs)).not.toContain("<locations>");

      const withLocs = buildMessages(
        "brainstorm",
        "test",
        emptyContext({
          locations: [makeLocation({ projectId: pid, name: "Town" })],
        }),
      );
      expect(getSystemText(withLocs)).toContain("<locations>");
    });

    it("includes <style-guide> section only when non-empty", () => {
      const noSg = buildMessages("brainstorm", "test", emptyContext());
      expect(getSystemText(noSg)).not.toContain("<style-guide>");

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
      expect(getSystemText(withSg)).toContain("<style-guide>");
    });

    it("includes <timeline> section only when non-empty", () => {
      const noTl = buildMessages("brainstorm", "test", emptyContext());
      expect(getSystemText(noTl)).not.toContain("<timeline>");

      const withTl = buildMessages(
        "brainstorm",
        "test",
        emptyContext({
          timelineEvents: [
            makeTimelineEvent({ projectId: pid, title: "Event" }),
          ],
        }),
      );
      expect(getSystemText(withTl)).toContain("<timeline>");
    });

    it("includes <worldbuilding> section only when non-empty", () => {
      const noWb = buildMessages("brainstorm", "test", emptyContext());
      expect(getSystemText(noWb)).not.toContain("<worldbuilding>");

      const withWb = buildMessages(
        "brainstorm",
        "test",
        emptyContext({
          worldbuildingDocs: [
            makeWorldbuildingDoc({ projectId: pid, title: "Lore" }),
          ],
        }),
      );
      expect(getSystemText(withWb)).toContain("<worldbuilding>");
    });

    it("includes <outline> section only when columns exist", () => {
      const noOutline = buildMessages("brainstorm", "test", emptyContext());
      expect(getSystemText(noOutline)).not.toContain("<outline>");

      const col = makeOutlineColumn({ projectId: pid, title: "Act I" });
      const char = makeCharacter({ projectId: pid, name: "Hero" });
      const chapter = makeChapter({ projectId: pid, title: "Chapter 1" });
      const card = makeOutlineCard({
        projectId: pid,
        columnId: col.id,
        title: "Opening",
        content: "The hero sets out",
        linkedCharacterIds: [char.id],
        linkedChapterIds: [chapter.id],
      });
      const withOutline = buildMessages(
        "brainstorm",
        "test",
        emptyContext({
          characters: [char],
          chapters: [chapter],
          outlineColumns: [col],
          outlineCards: [card],
        }),
      );
      const text = getSystemText(withOutline);
      expect(text).toContain("<outline>");
      expect(text).toContain('column title="Act I"');
      expect(text).toContain('card title="Opening"');
      expect(text).toContain("<notes>The hero sets out</notes>");
      expect(text).toContain("<linked-characters>Hero</linked-characters>");
      expect(text).toContain("<linked-chapters>Chapter 1</linked-chapters>");
      expect(text).toContain("</outline>");
    });

    it("includes <relationships> section only when non-empty and valid", () => {
      const noRel = buildMessages("brainstorm", "test", emptyContext());
      expect(getSystemText(noRel)).not.toContain("<relationships>");

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
      expect(getSystemText(withRel)).toContain("<relationships>");
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
      const chapterMsg = msgs.find(
        (m) =>
          m.role === "user" &&
          typeof m.content !== "string" &&
          Array.isArray(m.content),
      );
      expect(chapterMsg).toBeDefined();
      const text = (chapterMsg?.content as ContentPart[])[0].text;
      expect(text).toContain('<chapter title="Chapter 1">');
      expect(text).toContain("Once upon a time...");
      expect(text).toContain("</chapter>");
    });

    it("uses 'Untitled' when no chapter title", () => {
      const ctx = emptyContext({ currentChapterContent: "text" });
      const msgs = buildMessages("brainstorm", "test", ctx);
      const chapterMsg = msgs.find(
        (m) =>
          m.role === "user" &&
          typeof m.content !== "string" &&
          Array.isArray(m.content),
      );
      const text = (chapterMsg?.content as ContentPart[])[0].text;
      expect(text).toContain('<chapter title="Untitled">');
    });

    it("includes assistant acknowledgment after chapter", () => {
      const ctx = emptyContext({ currentChapterContent: "text" });
      const msgs = buildMessages("brainstorm", "test", ctx);
      const ack = msgs.find(
        (m) =>
          m.role === "assistant" &&
          typeof m.content === "string" &&
          m.content.includes("I've read the chapter"),
      );
      expect(ack).toBeDefined();
    });

    it("omits chapter message when no chapter content", () => {
      const msgs = buildMessages("brainstorm", "test", emptyContext());
      const userMsgs = msgs.filter((m) => m.role === "user");
      // Should be only one user message (the final prompt)
      expect(userMsgs).toHaveLength(1);
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

      // Find indices
      const ackIdx = msgs.findIndex(
        (m) =>
          m.role === "assistant" &&
          typeof m.content === "string" &&
          m.content.includes("I've read the chapter"),
      );
      const historyStartIdx = msgs.findIndex(
        (m) => m.content === "first question",
      );
      const finalIdx = msgs.findIndex((m) => m.content === "follow up");

      expect(ackIdx).toBeLessThan(historyStartIdx);
      expect(historyStartIdx).toBeLessThan(finalIdx);
    });
  });

  describe("cache control", () => {
    it("sets ephemeral cache_control on system context", () => {
      const msgs = buildMessages("brainstorm", "test", emptyContext());
      const sys = msgs.find((m) => m.role === "system");
      const parts = sys?.content as ContentPart[];
      expect(parts[0].cache_control).toEqual({ type: "ephemeral" });
    });

    it("sets ephemeral cache_control on chapter content", () => {
      const ctx = emptyContext({ currentChapterContent: "text" });
      const msgs = buildMessages("brainstorm", "test", ctx);
      const chapterMsg = msgs.find(
        (m) =>
          m.role === "user" &&
          typeof m.content !== "string" &&
          Array.isArray(m.content),
      );
      expect((chapterMsg?.content as ContentPart[])[0].cache_control).toEqual({
        type: "ephemeral",
      });
    });
  });
});
