import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../database";
import {
  createChapter,
  createChapterFromRow,
  createComment,
  createOutlineGridRow,
  createProject,
  createScene,
  createSnapshot,
  getChaptersByProject,
  getOutlineGridRowsByProject,
  getScenesByChapter,
  linkChapterToRow,
  putIndexedChunk,
  syncDeleteOutlineRow,
  syncReorderOutlineRows,
  unlinkChapterFromRow,
  updateRowLabel,
} from "./index";

beforeEach(async () => {
  await db.projects.clear();
  await db.chapters.clear();
  await db.outlineGridRows.clear();
  await db.outlineGridCells.clear();
  await db.comments.clear();
  await db.chapterSnapshots.clear();
  await db.scenes.clear();
  await db.indexedChunks.clear();
});

describe("linkChapterToRow", () => {
  it("links a chapter to a row and clears the row label", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });
    const row = await createOutlineGridRow({
      projectId: project.id,
      label: "My Row",
    });

    await linkChapterToRow(chapter.id, row.id);

    const updatedRow = await db.outlineGridRows.get(row.id);
    expect(updatedRow?.linkedChapterId).toBe(chapter.id);
    expect(updatedRow?.label).toBe("");
  });
});

describe("unlinkChapterFromRow", () => {
  it("unlinks a chapter and preserves the chapter title as label", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });
    const row = await createOutlineGridRow({
      projectId: project.id,
      linkedChapterId: chapter.id,
      label: "",
    });

    await unlinkChapterFromRow(row.id);

    const updatedRow = await db.outlineGridRows.get(row.id);
    expect(updatedRow?.linkedChapterId).toBeNull();
    expect(updatedRow?.label).toBe("Ch1");
  });
});

describe("createChapterFromRow", () => {
  it("creates a chapter linked to the row with correct title", async () => {
    const project = await createProject({ title: "P" });
    const row = await createOutlineGridRow({
      projectId: project.id,
      label: "My Chapter",
    });

    const chapterId = await createChapterFromRow(row.id, project.id);

    const chapter = await db.chapters.get(chapterId);
    expect(chapter?.title).toBe("My Chapter");

    const updatedRow = await db.outlineGridRows.get(row.id);
    expect(updatedRow?.linkedChapterId).toBe(chapterId);
    expect(updatedRow?.label).toBe("");
  });

  it("seeds the core scene", async () => {
    const project = await createProject({ title: "P" });
    const row = await createOutlineGridRow({
      projectId: project.id,
      label: "My Chapter",
    });

    const chapterId = await createChapterFromRow(row.id, project.id);

    const scenes = await getScenesByChapter(chapterId);
    expect(scenes).toHaveLength(1);
    expect(scenes[0].order).toBe(0);
  });

  it("uses 'New Chapter' when row label is empty", async () => {
    const project = await createProject({ title: "P" });
    const row = await createOutlineGridRow({
      projectId: project.id,
      label: "",
    });

    const chapterId = await createChapterFromRow(row.id, project.id);

    const chapter = await db.chapters.get(chapterId);
    expect(chapter?.title).toBe("New Chapter");
  });

  it("calculates correct chapter order based on linked rows", async () => {
    const project = await createProject({ title: "P" });
    const ch1 = await createChapter({ projectId: project.id, title: "Ch1" });
    const ch2 = await createChapter({
      projectId: project.id,
      title: "Ch2",
      order: 1,
    });

    await createOutlineGridRow({
      projectId: project.id,
      linkedChapterId: ch1.id,
      order: 0,
    });
    const row2 = await createOutlineGridRow({
      projectId: project.id,
      label: "New Row",
      order: 1,
    });
    await createOutlineGridRow({
      projectId: project.id,
      linkedChapterId: ch2.id,
      order: 2,
    });

    const newChapterId = await createChapterFromRow(row2.id, project.id);

    const newChapter = await db.chapters.get(newChapterId);
    // New chapter should be at order 1 (after ch1, before ch2)
    expect(newChapter?.order).toBe(1);
  });

  it("keeps nested linked chapters in their own sibling order, not globally flattened", async () => {
    const project = await createProject({ title: "P" });
    const ch1 = await createChapter({ projectId: project.id, title: "Ch1" });
    const parent = await createChapter({
      projectId: project.id,
      title: "Parent",
    });
    const child = await createChapter({
      projectId: project.id,
      title: "Child",
      parentChapterId: parent.id,
    });

    await createOutlineGridRow({
      projectId: project.id,
      linkedChapterId: ch1.id,
      order: 0,
    });
    await createOutlineGridRow({
      projectId: project.id,
      linkedChapterId: child.id,
      order: 1,
    });
    const newRow = await createOutlineGridRow({
      projectId: project.id,
      label: "New",
      order: 2,
    });

    await createChapterFromRow(newRow.id, project.id);

    // The child is 2nd among linked chapters in the outline, but it stays order
    // 0 within its parent group — a global renumber would have set it to 1.
    const updatedChild = await db.chapters.get(child.id);
    expect(updatedChild?.order).toBe(0);
    expect(updatedChild?.parentChapterId).toBe(parent.id);
  });
});

describe("updateRowLabel", () => {
  it("updates row label when row is not linked", async () => {
    const project = await createProject({ title: "P" });
    const row = await createOutlineGridRow({
      projectId: project.id,
      label: "Old Label",
    });

    await updateRowLabel(row.id, "New Label");

    const updatedRow = await db.outlineGridRows.get(row.id);
    expect(updatedRow?.label).toBe("New Label");
  });

  it("auto-syncs to chapter when row is linked", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Old Title",
    });
    const row = await createOutlineGridRow({
      projectId: project.id,
      linkedChapterId: chapter.id,
      label: "",
    });

    await updateRowLabel(row.id, "New Title");

    const updatedChapter = await db.chapters.get(chapter.id);
    expect(updatedChapter?.title).toBe("New Title");

    // Row label should stay empty when linked
    const updatedRow = await db.outlineGridRows.get(row.id);
    expect(updatedRow?.label).toBe("");
  });
});

describe("syncReorderOutlineRows", () => {
  it("reorders rows without moving the linked chapters", async () => {
    const project = await createProject({ title: "P" });
    const ch1 = await createChapter({
      projectId: project.id,
      title: "Ch1",
      order: 0,
    });
    const ch2 = await createChapter({
      projectId: project.id,
      title: "Ch2",
      order: 1,
    });

    const row1 = await createOutlineGridRow({
      projectId: project.id,
      linkedChapterId: ch1.id,
      order: 0,
    });
    const row2 = await createOutlineGridRow({
      projectId: project.id,
      linkedChapterId: ch2.id,
      order: 1,
    });

    // Swap row order
    await syncReorderOutlineRows([row2.id, row1.id]);

    const rows = await getOutlineGridRowsByProject(project.id);
    expect(rows[0].id).toBe(row2.id);
    expect(rows[1].id).toBe(row1.id);

    // The binder owns chapter order; rows reordering must NOT move chapters.
    const chapters = await getChaptersByProject(project.id);
    expect(chapters[0].id).toBe(ch1.id);
    expect(chapters[1].id).toBe(ch2.id);
  });

  it("reorders only the outline rows it is given", async () => {
    const project = await createProject({ title: "P" });
    const ch1 = await createChapter({ projectId: project.id, title: "Ch1" });

    const linkedRow = await createOutlineGridRow({
      projectId: project.id,
      linkedChapterId: ch1.id,
      order: 0,
    });
    const unlinkedRow = await createOutlineGridRow({
      projectId: project.id,
      label: "Unlinked",
      order: 1,
    });

    await syncReorderOutlineRows([unlinkedRow.id, linkedRow.id]);

    const rows = await getOutlineGridRowsByProject(project.id);
    expect(rows[0].id).toBe(unlinkedRow.id);
    expect(rows[1].id).toBe(linkedRow.id);

    // Chapter order is untouched by row reordering.
    const chapter = await db.chapters.get(ch1.id);
    expect(chapter?.order).toBe(0);
  });
});

describe("syncDeleteOutlineRow", () => {
  it("deletes row and unlinks chapter when cascade=false", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });
    const row = await createOutlineGridRow({
      projectId: project.id,
      linkedChapterId: chapter.id,
    });

    await syncDeleteOutlineRow(row.id, false);

    const deletedRow = await db.outlineGridRows.get(row.id);
    expect(deletedRow).toBeUndefined();

    const existingChapter = await db.chapters.get(chapter.id);
    expect(existingChapter).toBeDefined();
  });

  it("deletes row and chapter when cascade=true", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });
    const row = await createOutlineGridRow({
      projectId: project.id,
      linkedChapterId: chapter.id,
    });

    await syncDeleteOutlineRow(row.id, true);

    const deletedRow = await db.outlineGridRows.get(row.id);
    expect(deletedRow).toBeUndefined();

    const deletedChapter = await db.chapters.get(chapter.id);
    expect(deletedChapter).toBeUndefined();
  });

  it("cascades to comments and snapshots when deleting linked chapter", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });
    const row = await createOutlineGridRow({
      projectId: project.id,
      linkedChapterId: chapter.id,
    });

    await createComment({
      projectId: project.id,
      chapterId: chapter.id,
      fromOffset: 0,
      toOffset: 10,
    });
    await createSnapshot({
      projectId: project.id,
      chapterId: chapter.id,
      name: "v1",
      content: "hello",
      wordCount: 1,
    });

    await syncDeleteOutlineRow(row.id, true);

    const comments = await db.comments
      .where({ chapterId: chapter.id })
      .toArray();
    expect(comments).toHaveLength(0);

    const snapshots = await db.chapterSnapshots
      .where({ chapterId: chapter.id })
      .toArray();
    expect(snapshots).toHaveLength(0);
  });

  it("cascades to scenes and indexed chunks when deleting linked chapter", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });
    const row = await createOutlineGridRow({
      projectId: project.id,
      linkedChapterId: chapter.id,
    });

    await createScene({ projectId: project.id, chapterId: chapter.id });
    await putIndexedChunk({
      projectId: project.id,
      sourceType: "chapter",
      sourceId: chapter.id,
      chunkIndex: 0,
      text: "t0",
      contentHash: "h0",
      vector: [0.1, 0.2],
      embeddingModel: "fake-v1",
    });

    await syncDeleteOutlineRow(row.id, true);

    const scenes = await db.scenes.where({ chapterId: chapter.id }).toArray();
    expect(scenes).toHaveLength(0);

    const chunks = await db.indexedChunks
      .where({ sourceId: chapter.id })
      .toArray();
    expect(chunks).toHaveLength(0);
  });

  it("compacts row orders after deleting middle row (cascade=false)", async () => {
    const project = await createProject({ title: "P" });
    const rows = [];
    for (let i = 0; i < 5; i++) {
      rows.push(
        await createOutlineGridRow({
          projectId: project.id,
          label: `R${i + 1}`,
        }),
      );
    }

    await syncDeleteOutlineRow(rows[2].id, false);

    const remaining = await getOutlineGridRowsByProject(project.id);
    expect(remaining).toHaveLength(4);
    expect(remaining.map((r) => r.order)).toEqual([0, 1, 2, 3]);
  });

  it("compacts both row and chapter orders after deleting middle linked row (cascade=true)", async () => {
    const project = await createProject({ title: "P" });
    const chapters = [];
    const rows = [];
    for (let i = 0; i < 5; i++) {
      const ch = await createChapter({
        projectId: project.id,
        title: `Ch${i + 1}`,
      });
      chapters.push(ch);
      rows.push(
        await createOutlineGridRow({
          projectId: project.id,
          linkedChapterId: ch.id,
        }),
      );
    }

    await syncDeleteOutlineRow(rows[2].id, true);

    const remainingRows = await getOutlineGridRowsByProject(project.id);
    expect(remainingRows).toHaveLength(4);
    expect(remainingRows.map((r) => r.order)).toEqual([0, 1, 2, 3]);

    const remainingChapters = await getChaptersByProject(project.id);
    expect(remainingChapters).toHaveLength(4);
    expect(remainingChapters.map((c) => c.order)).toEqual([0, 1, 2, 3]);
  });

  it("leaves orders unchanged when deleting the last row", async () => {
    const project = await createProject({ title: "P" });
    const rows = [];
    for (let i = 0; i < 3; i++) {
      rows.push(
        await createOutlineGridRow({
          projectId: project.id,
          label: `R${i + 1}`,
        }),
      );
    }

    await syncDeleteOutlineRow(rows[2].id, false);

    const remaining = await getOutlineGridRowsByProject(project.id);
    expect(remaining.map((r) => r.order)).toEqual([0, 1]);
  });
});
