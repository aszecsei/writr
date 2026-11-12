import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import type { ChapterId, ProjectId } from "@/db/schemas";
import { makeChapter, resetIdCounter } from "@/test/helpers";
import { executeTool } from "../tools";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const otherProjectId = "b2222222-2222-4222-b222-222222222222" as ProjectId;
const ctx = { projectId };

function scratch(overrides: Partial<Parameters<typeof makeChapter>[0]> = {}) {
  return makeChapter({
    projectId,
    title: "Note",
    section: "scratchpad",
    ...overrides,
  });
}

describe("scratchpad tools", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
    await db.scenes.clear();
    await db.writingSessions.clear();
  });

  describe("read_scratchpad", () => {
    it("lists only scratchpad documents when called without an id", async () => {
      const note = scratch({ title: "Ideas" });
      await db.chapters.bulkAdd([
        note,
        scratch({ title: "Divider", kind: "separator" }),
        makeChapter({ projectId, title: "Chapter 1" }),
        scratch({ projectId: otherProjectId, title: "Elsewhere" }),
      ]);

      const result = await executeTool("read_scratchpad", {}, ctx);

      expect(result.success).toBe(true);
      expect(result.data?.entries).toEqual([
        { id: note.id, title: "Ideas", wordCount: 0, parentId: null },
      ]);
    });

    it("returns a document's content by id", async () => {
      const note = scratch({ content: "Remember the lighthouse." });
      await db.chapters.add(note);

      const result = await executeTool("read_scratchpad", { id: note.id }, ctx);

      expect(result.data?.content).toBe("Remember the lighthouse.");
    });

    it("refuses a manuscript chapter id", async () => {
      const chapter = makeChapter({ projectId, title: "Chapter 1" });
      await db.chapters.add(chapter);

      const result = await executeTool(
        "read_scratchpad",
        { id: chapter.id },
        ctx,
      );

      expect(result.success).toBe(false);
    });

    it("refuses a scratchpad document from another project", async () => {
      const note = scratch({ projectId: otherProjectId });
      await db.chapters.add(note);

      const result = await executeTool("read_scratchpad", { id: note.id }, ctx);

      expect(result.success).toBe(false);
    });
  });

  describe("write_scratchpad", () => {
    it("creates a scratchpad document when called without an id", async () => {
      const result = await executeTool(
        "write_scratchpad",
        { title: "Plot holes", content: "Who locked the door?" },
        ctx,
      );

      const row = await db.chapters.get(result.data?.id as ChapterId);
      expect(row?.section).toBe("scratchpad");
      expect(row?.content).toBe("Who locked the door?");
      expect(row?.wordCount).toBe(4);
    });

    it("nests a new document under a scratchpad parent", async () => {
      const parent = scratch();
      await db.chapters.add(parent);

      const result = await executeTool(
        "write_scratchpad",
        { title: "Child", content: "x", parentId: parent.id },
        ctx,
      );

      const row = await db.chapters.get(result.data?.id as ChapterId);
      expect(row?.parentChapterId).toBe(parent.id);
    });

    it("fails to create without a title", async () => {
      const result = await executeTool(
        "write_scratchpad",
        { content: "orphan" },
        ctx,
      );

      expect(result.success).toBe(false);
      expect(await db.chapters.count()).toBe(0);
    });

    it("replaces content by default", async () => {
      const note = scratch({ content: "old text", wordCount: 2 });
      await db.chapters.add(note);

      await executeTool(
        "write_scratchpad",
        { id: note.id, content: "brand new words here" },
        ctx,
      );

      const row = await db.chapters.get(note.id);
      expect(row?.content).toBe("brand new words here");
      expect(row?.wordCount).toBe(4);
    });

    it("appends content after the existing body in append mode", async () => {
      const note = scratch({ content: "First thought.", wordCount: 2 });
      await db.chapters.add(note);

      await executeTool(
        "write_scratchpad",
        { id: note.id, content: "Second thought.", mode: "append" },
        ctx,
      );

      const row = await db.chapters.get(note.id);
      expect(row?.content).toBe("First thought.\n\nSecond thought.");
      expect(row?.wordCount).toBe(4);
    });

    it("does not record a writing session", async () => {
      const note = scratch();
      await db.chapters.add(note);

      await executeTool(
        "write_scratchpad",
        { id: note.id, content: "many words the model wrote" },
        ctx,
      );

      expect(await db.writingSessions.count()).toBe(0);
    });

    it("refuses a manuscript chapter id and leaves it unchanged", async () => {
      const chapter = makeChapter({
        projectId,
        title: "Chapter 1",
        content: "Original prose.",
      });
      await db.chapters.add(chapter);

      const result = await executeTool(
        "write_scratchpad",
        { id: chapter.id, content: "Overwritten." },
        ctx,
      );

      expect(result.success).toBe(false);
      expect((await db.chapters.get(chapter.id))?.content).toBe(
        "Original prose.",
      );
    });
  });

  describe("delete_scratchpad", () => {
    it("deletes the document and promotes its children", async () => {
      const parent = scratch({ title: "Parent" });
      const child = scratch({ title: "Child", parentChapterId: parent.id });
      await db.chapters.bulkAdd([parent, child]);

      const result = await executeTool(
        "delete_scratchpad",
        { id: parent.id },
        ctx,
      );

      expect(result.success).toBe(true);
      expect(await db.chapters.get(parent.id)).toBeUndefined();
      expect((await db.chapters.get(child.id))?.parentChapterId).toBeNull();
    });

    it("refuses a manuscript chapter id", async () => {
      const chapter = makeChapter({ projectId, title: "Chapter 1" });
      await db.chapters.add(chapter);

      const result = await executeTool(
        "delete_scratchpad",
        { id: chapter.id },
        ctx,
      );

      expect(result.success).toBe(false);
      expect(await db.chapters.get(chapter.id)).toBeDefined();
    });
  });
});
