import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import type { ChapterId, ProjectId } from "@/db/schemas";
import { makeChapter, resetIdCounter } from "@/test/helpers";
import { executeTool } from "../tools";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const ctx = { projectId };

describe("chapter tools", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
  });

  it("create_chapter creates a chapter", async () => {
    const result = await executeTool(
      "create_chapter",
      { title: "Chapter 1", synopsis: "The beginning" },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.title).toBe("Chapter 1");
  });

  it("update_chapter modifies title and status", async () => {
    const created = await executeTool(
      "create_chapter",
      { title: "Draft Chapter" },
      ctx,
    );
    await executeTool(
      "update_chapter",
      {
        id: created.data?.id as string,
        title: "Revised Chapter",
        status: "revised",
      },
      ctx,
    );

    const updated = await db.chapters.get(created.data?.id as ChapterId);
    expect(updated?.title).toBe("Revised Chapter");
    expect(updated?.status).toBe("revised");
  });

  it("update_chapter rejects an invalid status enum value", async () => {
    const created = await executeTool("create_chapter", { title: "Ch1" }, ctx);
    const result = await executeTool(
      "update_chapter",
      { id: created.data?.id as string, status: "published" },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid parameters");
  });

  describe("search_chapters", () => {
    it("finds matching content; returns empty for no matches", async () => {
      const ch = makeChapter({
        projectId,
        title: "Forest Walk",
        content: "The trees whispered in the dark forest.",
      });
      await db.chapters.add(ch);

      const found = await executeTool(
        "search_chapters",
        { query: "forest" },
        ctx,
      );
      expect(found.success).toBe(true);
      expect(found.data?.matches as { id: string }[]).toHaveLength(1);

      const empty = await executeTool(
        "search_chapters",
        { query: "dragon" },
        ctx,
      );
      expect(empty.success).toBe(true);
      expect(empty.data?.matches as { id: string }[]).toHaveLength(0);
    });

    it("rejects missing query", async () => {
      const result = await executeTool("search_chapters", {}, ctx);
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid parameters");
    });
  });

  describe("read_chapter", () => {
    it("returns full content", async () => {
      const ch = makeChapter({
        projectId,
        title: "Intro",
        content: "Once upon a time...",
      });
      await db.chapters.add(ch);
      const result = await executeTool("read_chapter", { id: ch.id }, ctx);
      expect(result.success).toBe(true);
      expect(result.data?.content).toBe("Once upon a time...");
    });
  });

  describe("read_chapter_range", () => {
    const paragraphs = Array.from(
      { length: 30 },
      (_, i) => `Paragraph ${i + 1}.`,
    );
    const content = paragraphs.join("\n\n");

    it("reads a valid range of paragraphs", async () => {
      const ch = makeChapter({ projectId, title: "Long", content });
      await db.chapters.add(ch);
      const result = await executeTool(
        "read_chapter_range",
        { id: ch.id, start: 5, end: 10 },
        ctx,
      );
      expect(result.success).toBe(true);
      expect(result.data?.start).toBe(5);
      expect(result.data?.end).toBe(10);
      expect(result.data?.totalParagraphs).toBe(30);
      expect(result.data?.content as string).toContain("Paragraph 5.");
      expect(result.data?.content as string).toContain("Paragraph 10.");
      expect(result.data?.content as string).not.toContain("Paragraph 4.");
    });

    it("clamps start to valid range", async () => {
      const ch = makeChapter({
        projectId,
        title: "Short",
        content: "One.\n\nTwo.",
      });
      await db.chapters.add(ch);
      const result = await executeTool(
        "read_chapter_range",
        { id: ch.id, start: 100 },
        ctx,
      );
      expect(result.success).toBe(true);
      expect(result.data?.start).toBe(2);
      expect(result.data?.end).toBe(2);
    });

    it("defaults end to start + 19", async () => {
      const ch = makeChapter({ projectId, title: "Long", content });
      await db.chapters.add(ch);
      const result = await executeTool(
        "read_chapter_range",
        { id: ch.id, start: 1 },
        ctx,
      );
      expect(result.success).toBe(true);
      expect(result.data?.start).toBe(1);
      expect(result.data?.end).toBe(20);
    });

    it("caps window at 50 paragraphs", async () => {
      const bigContent = Array.from(
        { length: 100 },
        (_, i) => `P${i + 1}`,
      ).join("\n\n");
      const ch = makeChapter({ projectId, title: "Big", content: bigContent });
      await db.chapters.add(ch);
      const result = await executeTool(
        "read_chapter_range",
        { id: ch.id, start: 1, end: 100 },
        ctx,
      );
      expect(result.success).toBe(true);
      expect(result.data?.end).toBe(50);
    });
  });

  describe("search_chapter", () => {
    it("finds matches with surrounding context; empty for an absent query", async () => {
      const ch = makeChapter({
        projectId,
        title: "Test",
        content:
          "The sun rose.\n\nThe dragon appeared.\n\nIt breathed fire.\n\nThe hero fled.",
      });
      await db.chapters.add(ch);
      const result = await executeTool(
        "search_chapter",
        { id: ch.id, query: "dragon" },
        ctx,
      );
      expect(result.success).toBe(true);
      expect(result.data?.totalMatches).toBe(1);
      const matches = result.data?.matches as {
        paragraph: number;
        snippet: string;
      }[];
      expect(matches[0].paragraph).toBe(2);
      expect(matches[0].snippet).toContain("The sun rose.");
      expect(matches[0].snippet).toContain("The dragon appeared.");
      expect(matches[0].snippet).toContain("It breathed fire.");

      const empty = await executeTool(
        "search_chapter",
        { id: ch.id, query: "unicorn" },
        ctx,
      );
      expect(empty.success).toBe(true);
      expect(empty.data?.totalMatches).toBe(0);
    });

    it("respects contextParagraphs parameter", async () => {
      const ch = makeChapter({
        projectId,
        title: "Test",
        content: "A.\n\nB.\n\nC.\n\nTarget word.\n\nE.\n\nF.\n\nG.",
      });
      await db.chapters.add(ch);
      const result = await executeTool(
        "search_chapter",
        { id: ch.id, query: "Target", contextParagraphs: 0 },
        ctx,
      );
      const matches = result.data?.matches as {
        paragraph: number;
        snippet: string;
      }[];
      expect(matches[0].snippet).toBe("Target word.");
    });
  });

  describe("get_chapter_structure", () => {
    it("detects scene breaks and returns scenes", async () => {
      const ch = makeChapter({
        projectId,
        title: "Scenes",
        content:
          "Scene one begins.\n\nMore scene one.\n\n---\n\nScene two starts.\n\nMore scene two.",
      });
      await db.chapters.add(ch);
      const result = await executeTool(
        "get_chapter_structure",
        { id: ch.id },
        ctx,
      );
      expect(result.success).toBe(true);
      const scenes = result.data?.scenes as {
        start: number;
        end: number;
        preview: string;
      }[];
      expect(scenes).toHaveLength(2);
      expect(scenes[0]).toEqual({
        start: 1,
        end: 2,
        preview: "Scene one begins.",
      });
      expect(scenes[1]).toEqual({
        start: 4,
        end: 5,
        preview: "Scene two starts.",
      });
      expect(result.data?.totalParagraphs).toBe(5);
    });

    it("returns single scene when no breaks", async () => {
      const ch = makeChapter({
        projectId,
        title: "No Breaks",
        content: "Just one scene.\n\nWith two paragraphs.",
      });
      await db.chapters.add(ch);
      const result = await executeTool(
        "get_chapter_structure",
        { id: ch.id },
        ctx,
      );
      const scenes = result.data?.scenes as {
        start: number;
        end: number;
        preview: string;
      }[];
      expect(scenes).toHaveLength(1);
      expect(scenes[0]).toEqual({
        start: 1,
        end: 2,
        preview: "Just one scene.",
      });
    });

    it("returns preview truncated to 80 chars", async () => {
      const longPara = "A".repeat(120);
      const ch = makeChapter({
        projectId,
        title: "Long",
        content: longPara,
      });
      await db.chapters.add(ch);
      const result = await executeTool(
        "get_chapter_structure",
        { id: ch.id },
        ctx,
      );
      const scenes = result.data?.scenes as {
        start: number;
        end: number;
        preview: string;
      }[];
      expect(scenes[0].preview).toHaveLength(80);
    });
  });

  describe("fails for an unknown chapter ID", () => {
    it.each([
      ["read_chapter", { id: "nonexistent" }],
      ["read_chapter_range", { id: "nonexistent", start: 1 }],
      ["search_chapter", { id: "nonexistent", query: "test" }],
      ["get_chapter_structure", { id: "nonexistent" }],
    ])("%s", async (toolId, params) => {
      const result = await executeTool(toolId, params, ctx);
      expect(result.success).toBe(false);
    });
  });
});
