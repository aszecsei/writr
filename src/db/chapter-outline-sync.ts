/**
 * Chapter-Outline Synchronization Module
 *
 * Centralizes all synchronization logic between chapters and outline rows.
 * UI components should use these functions instead of manipulating linked state directly.
 *
 * Core invariants:
 * 1. When a row is linked to a chapter, the row's `label` is cleared — the chapter
 *    title becomes the single source of truth for display.
 * 2. When a row is unlinked, the chapter title is copied into the row's `label`,
 *    preserving the semantic meaning without data loss.
 * 3. Reordering is bidirectional: reordering chapters moves linked rows to match
 *    (unlinked rows shift to the end), and reordering rows updates linked chapter
 *    order correspondingly.
 * 4. Delete operations support a `cascade` flag: true deletes both sides plus
 *    dependents (cells, comments, snapshots); false unlinks and preserves the
 *    "other side" with invariant #2.
 */

import { generateId } from "@/lib/id";
import { db } from "./database";
import { ChapterSchema } from "./schemas";

function now(): string {
  return new Date().toISOString();
}

// ─── Link/Unlink Operations ─────────────────────────────────────────────

/**
 * Links a chapter to an outline row.
 * Clears the row label (chapter title is used instead).
 */
export async function linkChapterToRow(
  chapterId: string,
  rowId: string,
): Promise<void> {
  await db.outlineGridRows.update(rowId, {
    linkedChapterId: chapterId,
    label: "", // Clear label when linked
    updatedAt: now(),
  });
}

/**
 * Unlinks a chapter from an outline row.
 * Preserves the chapter title as the row label.
 */
export async function unlinkChapterFromRow(rowId: string): Promise<void> {
  const row = await db.outlineGridRows.get(rowId);
  if (!row || !row.linkedChapterId) return;

  const chapter = await db.chapters.get(row.linkedChapterId);
  const label = chapter?.title ?? "";

  await db.outlineGridRows.update(rowId, {
    linkedChapterId: null,
    label,
    updatedAt: now(),
  });
}

/**
 * Creates a new chapter from an outline row and links them.
 * Uses the row label as the chapter title, or "New Chapter" if empty.
 * Reorders all chapters to match outline order.
 */
export async function createChapterFromRow(
  rowId: string,
  projectId: string,
): Promise<string> {
  return db.transaction("rw", [db.chapters, db.outlineGridRows], async () => {
    const row = await db.outlineGridRows.get(rowId);
    if (!row) throw new Error("Row not found");

    const title = row.label.trim() || "New Chapter";

    // Calculate order based on linked chapters
    const allRows = await db.outlineGridRows
      .where({ projectId })
      .sortBy("order");
    const linkedRowsBefore = allRows
      .slice(
        0,
        allRows.findIndex((r) => r.id === rowId),
      )
      .filter((r) => r.linkedChapterId != null);
    const order = linkedRowsBefore.length;

    const chapter = ChapterSchema.parse({
      id: generateId(),
      projectId,
      title,
      order,
      content: "",
      synopsis: "",
      status: "draft",
      wordCount: 0,
      createdAt: now(),
      updatedAt: now(),
    });
    await db.chapters.add(chapter);

    // Link row to chapter
    await db.outlineGridRows.update(rowId, {
      linkedChapterId: chapter.id,
      label: "",
      updatedAt: now(),
    });

    // Reorder all chapters to match outline order
    const orderedRowIds = allRows.map((r) => r.id);
    await syncChapterOrderFromRows(orderedRowIds);

    return chapter.id;
  });
}

// ─── Label/Title Update ─────────────────────────────────────────────────

/**
 * Updates a row label. Auto-syncs to the linked chapter if present.
 * This is the key function that removes conditional logic from the UI.
 */
export async function updateRowLabel(
  rowId: string,
  label: string,
): Promise<void> {
  const row = await db.outlineGridRows.get(rowId);
  if (!row) return;

  if (row.linkedChapterId) {
    // Row is linked to a chapter - update the chapter title
    await db.chapters.update(row.linkedChapterId, {
      title: label,
      updatedAt: now(),
    });
    // Row label stays empty when linked
  } else {
    // Row is not linked - update the row label
    await db.outlineGridRows.update(rowId, {
      label,
      updatedAt: now(),
    });
  }
}

// ─── Reorder Operations ─────────────────────────────────────────────────

/**
 * Reorders chapters and auto-syncs linked outline rows.
 * Linked rows are reordered to match chapter order.
 * Unlinked rows are moved to the end.
 */
export async function syncReorderChapters(
  orderedChapterIds: string[],
): Promise<void> {
  await db.transaction("rw", [db.chapters, db.outlineGridRows], async () => {
    // Update chapter orders
    for (let i = 0; i < orderedChapterIds.length; i++) {
      await db.chapters.update(orderedChapterIds[i], { order: i });
    }

    // Get all outline rows and build a map of chapterId -> row
    const allRows = await db.outlineGridRows.toArray();
    const chapterToRow = new Map(
      allRows
        .filter((r) => r.linkedChapterId != null)
        .map((r) => [r.linkedChapterId, r]),
    );

    // Reorder linked rows to match chapter order, keeping unlinked rows at the end
    const linkedRows = orderedChapterIds
      .map((chapterId) => chapterToRow.get(chapterId))
      .filter((r): r is NonNullable<typeof r> => r != null);

    const unlinkedRows = allRows
      .filter((r) => r.linkedChapterId == null)
      .sort((a, b) => a.order - b.order);

    const reorderedRows = [...linkedRows, ...unlinkedRows];
    for (let i = 0; i < reorderedRows.length; i++) {
      await db.outlineGridRows.update(reorderedRows[i].id, { order: i });
    }
  });
}

/**
 * Reorders outline rows and auto-syncs linked chapters.
 * Linked chapters are reordered to match their row order.
 */
export async function syncReorderOutlineRows(
  orderedRowIds: string[],
): Promise<void> {
  await db.transaction("rw", [db.outlineGridRows, db.chapters], async () => {
    // Update row orders
    for (let i = 0; i < orderedRowIds.length; i++) {
      await db.outlineGridRows.update(orderedRowIds[i], { order: i });
    }

    // Fetch rows to get linked chapter IDs in order
    const rows = await db.outlineGridRows.bulkGet(orderedRowIds);
    const linkedChapterIds = rows
      .map((r) => r?.linkedChapterId)
      .filter((id): id is string => id != null);

    // Update linked chapter orders
    for (let i = 0; i < linkedChapterIds.length; i++) {
      await db.chapters.update(linkedChapterIds[i], { order: i });
    }
  });
}

/**
 * Internal helper: sync chapter order based on row order.
 * Used after creating/linking a chapter.
 */
async function syncChapterOrderFromRows(
  orderedRowIds: string[],
): Promise<void> {
  const rows = await db.outlineGridRows.bulkGet(orderedRowIds);
  const linkedChapterIds = rows
    .map((r) => r?.linkedChapterId)
    .filter((id): id is string => id != null);

  for (let i = 0; i < linkedChapterIds.length; i++) {
    await db.chapters.update(linkedChapterIds[i], { order: i });
  }
}

// ─── Delete Operations ──────────────────────────────────────────────────

/**
 * Deletes a chapter with optional cascade to linked outline row.
 * @param cascade If true, also deletes the linked outline row. If false, just unlinks.
 */
export async function syncDeleteChapter(
  chapterId: string,
  cascade: boolean,
): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.chapters,
      db.outlineGridRows,
      db.outlineGridCells,
      db.comments,
      db.chapterSnapshots,
    ],
    async () => {
      const row = await db.outlineGridRows
        .where({ linkedChapterId: chapterId })
        .first();

      if (row) {
        if (cascade) {
          // Delete both chapter and row
          await db.outlineGridCells.where({ rowId: row.id }).delete();
          await db.outlineGridRows.delete(row.id);
        } else {
          // Unlink row, preserving chapter title as label
          const chapter = await db.chapters.get(chapterId);
          await db.outlineGridRows.update(row.id, {
            linkedChapterId: null,
            label: chapter?.title ?? "",
            updatedAt: now(),
          });
        }
      }

      await db.comments.where({ chapterId }).delete();
      await db.chapterSnapshots.where({ chapterId }).delete();
      await db.chapters.delete(chapterId);
    },
  );
}

/**
 * Deletes an outline row with optional cascade to linked chapter.
 * @param cascade If true, also deletes the linked chapter. If false, just unlinks.
 */
export async function syncDeleteOutlineRow(
  rowId: string,
  cascade: boolean,
): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.outlineGridRows,
      db.outlineGridCells,
      db.chapters,
      db.comments,
      db.chapterSnapshots,
    ],
    async () => {
      const row = await db.outlineGridRows.get(rowId);
      if (!row) return;

      if (row.linkedChapterId && cascade) {
        await db.comments.where({ chapterId: row.linkedChapterId }).delete();
        await db.chapterSnapshots
          .where({ chapterId: row.linkedChapterId })
          .delete();
        await db.chapters.delete(row.linkedChapterId);
      }

      await db.outlineGridCells.where({ rowId }).delete();
      await db.outlineGridRows.delete(rowId);
    },
  );
}

// ─── Query Operations ───────────────────────────────────────────────────

/**
 * Checks if a chapter has a linked outline row.
 * Used by UI for delete confirmation dialogs.
 */
export async function hasLinkedRow(chapterId: string): Promise<boolean> {
  const row = await db.outlineGridRows
    .where({ linkedChapterId: chapterId })
    .first();
  return row !== undefined;
}

/**
 * Gets the outline row linked to a chapter.
 * Returns undefined if the chapter has no linked row.
 */
export async function getLinkedRow(
  chapterId: string,
): Promise<{ id: string; label: string } | undefined> {
  const row = await db.outlineGridRows
    .where({ linkedChapterId: chapterId })
    .first();
  if (!row) return undefined;
  return { id: row.id, label: row.label };
}

/**
 * Checks if an outline row has a linked chapter.
 * Used by UI for delete confirmation dialogs.
 */
export async function hasLinkedChapter(rowId: string): Promise<boolean> {
  const row = await db.outlineGridRows.get(rowId);
  return row?.linkedChapterId != null;
}
