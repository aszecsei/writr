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
 * 3. Reordering rows is row-only: the binder owns chapter order under the nested
 *    model, so reordering outline rows reorders rows alone and does not move the
 *    linked chapters.
 * 4. Delete operations support a `cascade` flag: true deletes both sides plus
 *    dependents (cells, comments, snapshots, scenes, indexed chunks) via the
 *    same cascade `deleteChapter` uses; false unlinks and preserves the
 *    "other side" with invariant #2.
 */

import { db } from "../database";
import type { ChapterId, OutlineGridRowId, ProjectId } from "../schemas";
import { createChapter, deleteRowAndDependents } from "./chapters";
import { compact, now, renumber } from "./helpers";

async function compactRowOrders(projectId: ProjectId): Promise<void> {
  const rows = await db.outlineGridRows.where({ projectId }).sortBy("order");
  await compact(db.outlineGridRows, rows);
}

async function compactChapterOrders(projectId: ProjectId): Promise<void> {
  const chapters = await db.chapters.where({ projectId }).toArray();
  // Chapter `order` is sibling-scoped under the binder, so compact within each
  // (section, parent) group — a global 0..n renumber would flatten the tree.
  const groups = new Map<string, typeof chapters>();
  for (const c of chapters) {
    const key = `${c.section ?? "manuscript"}|${c.parentChapterId ?? "root"}`;
    const group = groups.get(key);
    if (group) group.push(c);
    else groups.set(key, [c]);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.order - b.order);
    await compact(db.chapters, group);
  }
}

// ─── Link/Unlink Operations ─────────────────────────────────────────────

/**
 * Links a chapter to an outline row.
 * Clears the row label (chapter title is used instead).
 */
export async function linkChapterToRow(
  chapterId: ChapterId,
  rowId: OutlineGridRowId,
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
export async function unlinkChapterFromRow(
  rowId: OutlineGridRowId,
): Promise<void> {
  const row = await db.outlineGridRows.get(rowId);
  if (!row?.linkedChapterId) return;

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
  rowId: OutlineGridRowId,
  projectId: ProjectId,
): Promise<ChapterId> {
  return db.transaction(
    "rw",
    [db.chapters, db.outlineGridRows, db.scenes],
    async () => {
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

      const chapter = await createChapter({ projectId, title, order });

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
    },
  );
}

// ─── Label/Title Update ─────────────────────────────────────────────────

/**
 * Updates a row label. Auto-syncs to the linked chapter if present.
 * This is the key function that removes conditional logic from the UI.
 */
export async function updateRowLabel(
  rowId: OutlineGridRowId,
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
 * Reorders outline rows only. The binder is the source of truth for chapter
 * order under the nested model, so reordering rows here does not move the
 * linked chapters (a flat row reorder can't map cleanly onto a tree).
 */
export async function syncReorderOutlineRows(
  orderedRowIds: OutlineGridRowId[],
): Promise<void> {
  await db.transaction("rw", db.outlineGridRows, () =>
    renumber(db.outlineGridRows, orderedRowIds),
  );
}

/**
 * Internal helper: align linked chapters' order with the outline row order.
 *
 * Sibling-aware: chapter `order` is scoped to each (section, parent) group, so
 * we assign 0..n-1 *within each group* in the relative sequence the chapters
 * appear in the outline — a global renumber would flatten the binder tree.
 */
async function syncChapterOrderFromRows(
  orderedRowIds: OutlineGridRowId[],
): Promise<void> {
  const rows = await db.outlineGridRows.bulkGet(orderedRowIds);
  const linkedChapterIds = rows
    .map((r) => r?.linkedChapterId)
    .filter((id): id is ChapterId => id != null);

  const chapters = await db.chapters.bulkGet(linkedChapterIds);
  const byId = new Map(chapters.filter((c) => c != null).map((c) => [c.id, c]));

  // Next order to hand out within each sibling group, keyed by section+parent.
  const nextOrderByGroup = new Map<string, number>();
  for (const id of linkedChapterIds) {
    const chapter = byId.get(id);
    if (!chapter) continue;
    const groupKey = `${chapter.section ?? "manuscript"}|${chapter.parentChapterId ?? "root"}`;
    const order = nextOrderByGroup.get(groupKey) ?? 0;
    nextOrderByGroup.set(groupKey, order + 1);
    if (chapter.order !== order) {
      await db.chapters.update(id, { order });
    }
  }
}

// ─── Delete Operations ──────────────────────────────────────────────────

/**
 * Deletes an outline row with optional cascade to linked chapter.
 * @param cascade If true, also deletes the linked chapter. If false, just unlinks.
 */
export async function syncDeleteOutlineRow(
  rowId: OutlineGridRowId,
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
      db.indexedChunks,
      db.scenes,
    ],
    async () => {
      const row = await db.outlineGridRows.get(rowId);
      if (!row) return;
      const { projectId } = row;
      const cascadedChapter = !!(row.linkedChapterId && cascade);

      if (cascadedChapter) {
        await deleteRowAndDependents(row.linkedChapterId as ChapterId);
      } else {
        await db.outlineGridCells.where({ rowId }).delete();
        await db.outlineGridRows.delete(rowId);
      }

      await compactRowOrders(projectId);
      if (cascadedChapter) await compactChapterOrders(projectId);
    },
  );
}
