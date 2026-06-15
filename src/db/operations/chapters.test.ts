import { beforeEach, describe, expect, it } from "vitest";
import {
  makeChapter,
  makeOutlineGridCell,
  makeOutlineGridColumn,
  makeOutlineGridRow,
  resetIdCounter,
} from "@/test/helpers";
import { db } from "../database";
import type { ChapterId, ProjectId } from "../schemas";
import {
  createChapter,
  createSeparator,
  deleteChapter,
  getBinderItems,
  getChaptersByProject,
  moveChapter,
  updateChapterContent,
} from "./chapters";
import { getIndexedChunksBySource, putIndexedChunk } from "./indexedChunks";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;

function chapterChunk(sourceId: string) {
  return {
    projectId,
    sourceType: "chapter" as const,
    sourceId,
    chunkIndex: 0,
    text: "t0",
    contentHash: "h0",
    vector: [0.1, 0.2],
    embeddingModel: "fake-v1",
  };
}

describe("updateChapterContent", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
    await db.writingSessions.clear();
  });

  it("records a session when word count decreases", async () => {
    const ch = makeChapter({ projectId, title: "Ch", wordCount: 100 });
    await db.chapters.add(ch);

    await updateChapterContent(ch.id, "shorter content", 50);

    const sessions = await db.writingSessions.toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].wordCountStart).toBe(100);
    expect(sessions[0].wordCountEnd).toBe(50);
  });

  it("does not throw for a nonexistent chapter ID", async () => {
    await expect(
      updateChapterContent(
        "00000000-0000-4000-8000-999999999999" as ChapterId,
        "content",
        10,
      ),
    ).resolves.toBeUndefined();
  });

  it("updates content and wordCount in the database", async () => {
    const ch = makeChapter({
      projectId,
      title: "Ch",
      content: "old",
      wordCount: 1,
    });
    await db.chapters.add(ch);

    await updateChapterContent(ch.id, "new content here", 3);

    const updated = await db.chapters.get(ch.id);
    expect(updated?.content).toBe("new content here");
    expect(updated?.wordCount).toBe(3);
  });
});

describe("createChapter (binder)", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
  });

  it("defaults to a top-level manuscript document", async () => {
    const ch = await createChapter({ projectId, title: "Root" });
    expect(ch.parentChapterId).toBeNull();
    expect(ch.section).toBe("manuscript");
    expect(ch.kind).toBe("document");
  });

  it("computes sibling-scoped order within a parent", async () => {
    const parent = await createChapter({ projectId, title: "Parent" });
    const c1 = await createChapter({
      projectId,
      title: "Child 1",
      parentChapterId: parent.id,
    });
    const c2 = await createChapter({
      projectId,
      title: "Child 2",
      parentChapterId: parent.id,
    });
    expect(c1.order).toBe(0);
    expect(c2.order).toBe(1);
    // A child of a different parent restarts at 0.
    const other = await createChapter({ projectId, title: "Other" });
    const c3 = await createChapter({
      projectId,
      title: "Child 3",
      parentChapterId: other.id,
    });
    expect(c3.order).toBe(0);
  });

  it("scopes order separately per section", async () => {
    const m = await createChapter({ projectId, title: "Manuscript Root" });
    const s = await createChapter({
      projectId,
      title: "Scratch Root",
      section: "scratchpad",
    });
    expect(m.order).toBe(0);
    expect(s.order).toBe(0);
  });
});

describe("createSeparator", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
  });

  it("creates a separator marker with compile defaults", async () => {
    const sep = await createSeparator({ projectId, title: "Part One" });
    expect(sep.kind).toBe("separator");
    expect(sep.includeInCompile).toBe(true);
    expect(sep.pageBreakBefore).toBe(false);
  });
});

describe("getChaptersByProject / getBinderItems filtering", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
  });

  it("getChaptersByProject returns only manuscript documents", async () => {
    await createChapter({ projectId, title: "Doc" });
    await createSeparator({ projectId, title: "Sep" });
    await createChapter({ projectId, title: "Scratch", section: "scratchpad" });

    const docs = await getChaptersByProject(projectId);
    expect(docs.map((c) => c.title)).toEqual(["Doc"]);
  });

  it("getBinderItems returns everything, or one section", async () => {
    await createChapter({ projectId, title: "Doc" });
    await createSeparator({ projectId, title: "Sep" });
    await createChapter({ projectId, title: "Scratch", section: "scratchpad" });

    expect(await getBinderItems(projectId)).toHaveLength(3);
    const manuscript = await getBinderItems(projectId, "manuscript");
    expect(manuscript.map((c) => c.title).sort()).toEqual(["Doc", "Sep"]);
    const scratch = await getBinderItems(projectId, "scratchpad");
    expect(scratch.map((c) => c.title)).toEqual(["Scratch"]);
  });
});

describe("moveChapter", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
  });

  it("reparents a node and inserts it before a target sibling", async () => {
    const a = await createChapter({ projectId, title: "A" });
    const b = await createChapter({ projectId, title: "B" });
    const child = await createChapter({
      projectId,
      title: "Child",
      parentChapterId: a.id,
    });

    // Move `b` under `a`, before `child`.
    await moveChapter(b.id, { parentChapterId: a.id, beforeId: child.id });

    const moved = await db.chapters.get(b.id);
    expect(moved?.parentChapterId).toBe(a.id);
    expect(moved?.order).toBe(0);
    const sibling = await db.chapters.get(child.id);
    expect(sibling?.order).toBe(1);
  });

  it("propagates a section change to the whole subtree", async () => {
    const parent = await createChapter({ projectId, title: "Parent" });
    const child = await createChapter({
      projectId,
      title: "Child",
      parentChapterId: parent.id,
    });
    const grandchild = await createChapter({
      projectId,
      title: "Grandchild",
      parentChapterId: child.id,
    });

    await moveChapter(parent.id, {
      parentChapterId: null,
      section: "scratchpad",
    });

    for (const id of [parent.id, child.id, grandchild.id]) {
      const row = await db.chapters.get(id);
      expect(row?.section).toBe("scratchpad");
    }
  });

  it("throws when a move would create a cycle", async () => {
    const parent = await createChapter({ projectId, title: "Parent" });
    const child = await createChapter({
      projectId,
      title: "Child",
      parentChapterId: parent.id,
    });

    await expect(
      moveChapter(parent.id, { parentChapterId: child.id }),
    ).rejects.toThrow(/cycle/i);
  });
});

describe("deleteChapter", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
    await db.outlineGridRows.clear();
    await db.outlineGridCells.clear();
    await db.comments.clear();
  });

  it("cascade removes the whole subtree and its linked outline rows", async () => {
    const parent = await createChapter({ projectId, title: "Parent" });
    const child = await createChapter({
      projectId,
      title: "Child",
      parentChapterId: parent.id,
    });
    const sibling = await createChapter({ projectId, title: "Sibling" });

    // Link an outline row + cell to the child so cascade cleanup is exercised.
    const column = makeOutlineGridColumn({ projectId, title: "Notes" });
    const row = makeOutlineGridRow({ projectId, linkedChapterId: child.id });
    const cell = makeOutlineGridCell({
      projectId,
      rowId: row.id,
      columnId: column.id,
    });
    await db.outlineGridColumns.add(column);
    await db.outlineGridRows.add(row);
    await db.outlineGridCells.add(cell);

    await deleteChapter(parent.id, "cascade");

    expect(await db.chapters.get(parent.id)).toBeUndefined();
    expect(await db.chapters.get(child.id)).toBeUndefined();
    expect(await db.outlineGridRows.get(row.id)).toBeUndefined();
    expect(await db.outlineGridCells.get(cell.id)).toBeUndefined();
    // The unrelated sibling survives.
    expect(await db.chapters.get(sibling.id)).toBeDefined();
  });

  it("promote re-parents children to the deleted node's parent", async () => {
    const grandparent = await createChapter({
      projectId,
      title: "Grandparent",
    });
    const parent = await createChapter({
      projectId,
      title: "Parent",
      parentChapterId: grandparent.id,
    });
    const child = await createChapter({
      projectId,
      title: "Child",
      parentChapterId: parent.id,
    });

    await deleteChapter(parent.id, "promote");

    expect(await db.chapters.get(parent.id)).toBeUndefined();
    const promoted = await db.chapters.get(child.id);
    expect(promoted?.parentChapterId).toBe(grandparent.id);
  });
});

describe("deleteChapter — indexed chunk cleanup", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
    await db.indexedChunks.clear();
  });

  it("cascade prunes chunks for every node in the subtree", async () => {
    const parent = await createChapter({ projectId, title: "Parent" });
    const child = await createChapter({
      projectId,
      title: "Child",
      parentChapterId: parent.id,
    });
    await putIndexedChunk(chapterChunk(parent.id));
    await putIndexedChunk(chapterChunk(child.id));

    await deleteChapter(parent.id, "cascade");

    expect(
      await getIndexedChunksBySource(projectId, "chapter", parent.id),
    ).toHaveLength(0);
    expect(
      await getIndexedChunksBySource(projectId, "chapter", child.id),
    ).toHaveLength(0);
  });

  it("promote prunes the deleted node's chunks but keeps promoted children's", async () => {
    const parent = await createChapter({ projectId, title: "Parent" });
    const child = await createChapter({
      projectId,
      title: "Child",
      parentChapterId: parent.id,
    });
    await putIndexedChunk(chapterChunk(parent.id));
    await putIndexedChunk(chapterChunk(child.id));

    await deleteChapter(parent.id, "promote");

    expect(
      await getIndexedChunksBySource(projectId, "chapter", parent.id),
    ).toHaveLength(0);
    expect(
      await getIndexedChunksBySource(projectId, "chapter", child.id),
    ).toHaveLength(1);
  });
});
