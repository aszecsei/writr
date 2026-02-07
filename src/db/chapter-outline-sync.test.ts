import { beforeEach, describe, expect, it } from "vitest";
import {
  createChapterFromRow,
  hasLinkedChapter,
  hasLinkedRow,
  linkChapterToRow,
  syncDeleteChapter,
  syncDeleteOutlineRow,
  syncReorderChapters,
  syncReorderOutlineRows,
  unlinkChapterFromRow,
  updateRowLabel,
} from "./chapter-outline-sync";
import { db } from "./database";
import {
  createChapter,
  createComment,
  createOutlineGridRow,
  createProject,
  createSnapshot,
  getChaptersByProject,
  getOutlineGridRowsByProject,
} from "./operations";

beforeEach(async () => {
  await db.projects.clear();
  await db.chapters.clear();
  await db.outlineGridRows.clear();
  await db.outlineGridCells.clear();
  await db.comments.clear();
  await db.chapterSnapshots.clear();
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

  it("does nothing if row is not linked", async () => {
    const project = await createProject({ title: "P" });
    const row = await createOutlineGridRow({
      projectId: project.id,
      label: "My Row",
    });

    await unlinkChapterFromRow(row.id);

    const updatedRow = await db.outlineGridRows.get(row.id);
    expect(updatedRow?.label).toBe("My Row");
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

describe("syncReorderChapters", () => {
  it("reorders chapters and syncs linked outline rows", async () => {
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

    // Swap chapter order
    await syncReorderChapters([ch2.id, ch1.id]);

    const chapters = await getChaptersByProject(project.id);
    expect(chapters[0].id).toBe(ch2.id);
    expect(chapters[1].id).toBe(ch1.id);

    const rows = await getOutlineGridRowsByProject(project.id);
    expect(rows[0].id).toBe(row2.id);
    expect(rows[1].id).toBe(row1.id);
  });

  it("keeps unlinked rows at the end", async () => {
    const project = await createProject({ title: "P" });
    const ch1 = await createChapter({ projectId: project.id, title: "Ch1" });

    const linkedRow = await createOutlineGridRow({
      projectId: project.id,
      linkedChapterId: ch1.id,
      order: 1,
    });
    const unlinkedRow = await createOutlineGridRow({
      projectId: project.id,
      label: "Unlinked",
      order: 0,
    });

    await syncReorderChapters([ch1.id]);

    const rows = await getOutlineGridRowsByProject(project.id);
    expect(rows[0].id).toBe(linkedRow.id);
    expect(rows[1].id).toBe(unlinkedRow.id);
  });
});

describe("syncReorderOutlineRows", () => {
  it("reorders rows and syncs linked chapters", async () => {
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

    const chapters = await getChaptersByProject(project.id);
    expect(chapters[0].id).toBe(ch2.id);
    expect(chapters[1].id).toBe(ch1.id);
  });

  it("only reorders linked chapters", async () => {
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

    // Chapter should now be at order 0 (only linked chapter)
    const chapter = await db.chapters.get(ch1.id);
    expect(chapter?.order).toBe(0);
  });
});

describe("syncDeleteChapter", () => {
  it("deletes chapter and unlinks row when cascade=false", async () => {
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

    await syncDeleteChapter(chapter.id, false);

    const deletedChapter = await db.chapters.get(chapter.id);
    expect(deletedChapter).toBeUndefined();

    const updatedRow = await db.outlineGridRows.get(row.id);
    expect(updatedRow).toBeDefined();
    expect(updatedRow?.linkedChapterId).toBeNull();
    expect(updatedRow?.label).toBe("Ch1");
  });

  it("deletes chapter and row when cascade=true", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });
    const row = await createOutlineGridRow({
      projectId: project.id,
      linkedChapterId: chapter.id,
    });

    await syncDeleteChapter(chapter.id, true);

    const deletedChapter = await db.chapters.get(chapter.id);
    expect(deletedChapter).toBeUndefined();

    const deletedRow = await db.outlineGridRows.get(row.id);
    expect(deletedRow).toBeUndefined();
  });

  it("deletes chapter without linked row", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    await syncDeleteChapter(chapter.id, false);

    const deletedChapter = await db.chapters.get(chapter.id);
    expect(deletedChapter).toBeUndefined();
  });

  it("cascades to comments and snapshots", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
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

    await syncDeleteChapter(chapter.id, false);

    const comments = await db.comments
      .where({ chapterId: chapter.id })
      .toArray();
    expect(comments).toHaveLength(0);

    const snapshots = await db.chapterSnapshots
      .where({ chapterId: chapter.id })
      .toArray();
    expect(snapshots).toHaveLength(0);
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

  it("deletes row without linked chapter", async () => {
    const project = await createProject({ title: "P" });
    const row = await createOutlineGridRow({
      projectId: project.id,
      label: "Unlinked",
    });

    await syncDeleteOutlineRow(row.id, false);

    const deletedRow = await db.outlineGridRows.get(row.id);
    expect(deletedRow).toBeUndefined();
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
});

describe("hasLinkedRow", () => {
  it("returns true when chapter has a linked row", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });
    await createOutlineGridRow({
      projectId: project.id,
      linkedChapterId: chapter.id,
    });

    const result = await hasLinkedRow(chapter.id);
    expect(result).toBe(true);
  });

  it("returns false when chapter has no linked row", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    const result = await hasLinkedRow(chapter.id);
    expect(result).toBe(false);
  });
});

describe("hasLinkedChapter", () => {
  it("returns true when row has a linked chapter", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });
    const row = await createOutlineGridRow({
      projectId: project.id,
      linkedChapterId: chapter.id,
    });

    const result = await hasLinkedChapter(row.id);
    expect(result).toBe(true);
  });

  it("returns false when row has no linked chapter", async () => {
    const project = await createProject({ title: "P" });
    const row = await createOutlineGridRow({
      projectId: project.id,
      label: "Unlinked",
    });

    const result = await hasLinkedChapter(row.id);
    expect(result).toBe(false);
  });
});
