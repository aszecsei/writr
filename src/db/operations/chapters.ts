import {
  flattenManuscript,
  isManuscriptDocument,
  subtreeIds,
  wouldCreateCycle,
} from "@/lib/binder/tree";
import { db } from "../database";
import {
  type Chapter,
  type ChapterId,
  ChapterSchema,
  type ChapterSection,
  type ProjectId,
} from "../schemas";
import { generateId, now } from "./helpers";
import { recordWritingSession } from "./sprints";

// ─── Chapters ────────────────────────────────────────────────────────

/**
 * The manuscript documents of a project, in sibling order. Separators and
 * scratchpad rows are intentionally excluded so existing consumers (word count,
 * AI context, outline sync, export of "real" chapters) stay correct-by-default.
 * For the full binder (all kinds / sections), use {@link getBinderItems}.
 */
export async function getChaptersByProject(
  projectId: ProjectId,
): Promise<Chapter[]> {
  const all = await db.chapters.where({ projectId }).sortBy("order");
  return all.filter(isManuscriptDocument);
}

/**
 * Every binder row for a project (documents and separators, both sections),
 * sorted by `order`. Pass `section` to scope to one tree. Used to assemble the
 * binder and to compile.
 */
export async function getBinderItems(
  projectId: ProjectId,
  section?: ChapterSection,
): Promise<Chapter[]> {
  const all = await db.chapters.where({ projectId }).sortBy("order");
  // Default-tolerant: a row with no section counts as "manuscript".
  return section
    ? all.filter((c) => (c.section ?? "manuscript") === section)
    : all;
}

export async function getChapter(id: ChapterId): Promise<Chapter | undefined> {
  return db.chapters.get(id);
}

/**
 * Manuscript documents in true reading order: the flattened depth-first
 * sequence (parent before children), separators and scratchpad excluded. This
 * is the canonical order for the AI reader pipeline, where sibling-scoped
 * `order` no longer linearizes the manuscript.
 */
export async function getManuscriptChaptersOrdered(
  projectId: ProjectId,
): Promise<Chapter[]> {
  const items = await getBinderItems(projectId);
  return flattenManuscript(items)
    .map((node) => node.chapter)
    .filter((c) => c.kind !== "separator");
}

/**
 * Next sibling-scoped order: max order among rows sharing the same
 * (projectId, section, parentChapterId), plus one — or 0 if the group is empty.
 */
async function nextSiblingOrder(
  projectId: ProjectId,
  section: ChapterSection,
  parentChapterId: ChapterId | null,
): Promise<number> {
  const siblings = (await db.chapters.where({ projectId }).toArray()).filter(
    (c) =>
      c.section === section && (c.parentChapterId ?? null) === parentChapterId,
  );
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((c) => c.order)) + 1;
}

export async function createChapter(
  data: Pick<Chapter, "projectId" | "title"> &
    Partial<
      Pick<
        Chapter,
        | "order"
        | "content"
        | "synopsis"
        | "parentChapterId"
        | "section"
        | "kind"
      >
    >,
): Promise<Chapter> {
  const parentChapterId = data.parentChapterId ?? null;
  const section = data.section ?? "manuscript";
  const order =
    data.order ??
    (await nextSiblingOrder(data.projectId, section, parentChapterId));
  const chapter = ChapterSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    title: data.title,
    order,
    content: data.content ?? "",
    synopsis: data.synopsis ?? "",
    status: "draft",
    wordCount: 0,
    parentChapterId,
    section,
    kind: data.kind ?? "document",
    createdAt: now(),
    updatedAt: now(),
  });
  await db.chapters.add(chapter);
  return chapter;
}

/** Create a separator marker (a non-document divider) in the binder. */
export async function createSeparator(
  data: Pick<Chapter, "projectId" | "title"> &
    Partial<Pick<Chapter, "parentChapterId" | "section" | "order">>,
): Promise<Chapter> {
  return createChapter({ ...data, kind: "separator" });
}

export async function updateChapter(
  id: ChapterId,
  data: Partial<Pick<Chapter, "title" | "synopsis" | "status">>,
): Promise<void> {
  await db.chapters.update(id, { ...data, updatedAt: now() });
}

/** Update the label and compile settings of a separator. */
export async function updateSeparator(
  id: ChapterId,
  data: Partial<
    Pick<Chapter, "title" | "includeInCompile" | "pageBreakBefore">
  >,
): Promise<void> {
  await db.chapters.update(id, { ...data, updatedAt: now() });
}

export async function updateChapterContent(
  id: ChapterId,
  content: string,
  wordCount: number,
): Promise<void> {
  const chapter = await db.chapters.get(id);
  const previousWordCount = chapter?.wordCount ?? 0;

  await db.chapters.update(id, { content, wordCount, updatedAt: now() });

  // Record writing session if word count changed
  if (chapter && wordCount !== previousWordCount) {
    recordWritingSession(chapter.projectId, id, previousWordCount, wordCount);
  }
}

/**
 * Re-parent and/or reorder a binder item.
 *
 * - Rejects moves that would create a cycle (a node under its own descendant).
 * - Inserts the moved node before `beforeId` in the destination sibling group,
 *   or at the end when `beforeId` is omitted / not found.
 * - When `section` changes, the change propagates to the entire moved subtree.
 *
 * Note: only the destination sibling group is renumbered; the vacated source
 * group keeps its (now gapped) order values — harmless, since the binder always
 * sorts siblings by `order`.
 */
export async function moveChapter(
  id: ChapterId,
  target: {
    parentChapterId: ChapterId | null;
    section?: ChapterSection;
    beforeId?: ChapterId | null;
  },
): Promise<void> {
  const chapter = await db.chapters.get(id);
  if (!chapter) throw new Error(`moveChapter: chapter not found: ${id}`);

  const all = await db.chapters
    .where({ projectId: chapter.projectId })
    .toArray();

  if (wouldCreateCycle(all, id, target.parentChapterId)) {
    throw new Error(
      `moveChapter: moving ${id} under ${target.parentChapterId} would create a cycle`,
    );
  }

  const newSection = target.section ?? chapter.section;
  const newParentId = target.parentChapterId ?? null;

  const destSiblings = all
    .filter(
      (c) =>
        c.id !== id &&
        c.section === newSection &&
        (c.parentChapterId ?? null) === newParentId,
    )
    .sort((a, b) => a.order - b.order);

  const orderedIds: ChapterId[] = [];
  let inserted = false;
  for (const c of destSiblings) {
    if (target.beforeId && c.id === target.beforeId) {
      orderedIds.push(id);
      inserted = true;
    }
    orderedIds.push(c.id);
  }
  if (!inserted) orderedIds.push(id);

  const sectionChanged = newSection !== chapter.section;
  const subtree = sectionChanged ? subtreeIds(all, id) : new Set<ChapterId>();

  await db.transaction("rw", db.chapters, async () => {
    await db.chapters.update(id, {
      parentChapterId: newParentId,
      section: newSection,
      updatedAt: now(),
    });
    for (let i = 0; i < orderedIds.length; i++) {
      await db.chapters.update(orderedIds[i], { order: i, updatedAt: now() });
    }
    if (sectionChanged) {
      for (const nodeId of subtree) {
        if (nodeId === id) continue;
        await db.chapters.update(nodeId, {
          section: newSection,
          updatedAt: now(),
        });
      }
    }
  });
}

/**
 * Remove a single binder row and every dependent that keys off its id: linked
 * outline rows (and their cells), comments, and snapshots. Does NOT compact
 * order values (sibling order tolerates gaps).
 */
async function deleteRowAndDependents(chapterId: ChapterId): Promise<void> {
  const linkedRows = await db.outlineGridRows
    .where({ linkedChapterId: chapterId })
    .toArray();
  for (const row of linkedRows) {
    await db.outlineGridCells.where({ rowId: row.id }).delete();
    await db.outlineGridRows.delete(row.id);
  }
  await db.comments.where({ chapterId }).delete();
  await db.chapterSnapshots.where({ chapterId }).delete();
  await db.chapters.delete(chapterId);
}

/**
 * Delete a binder item.
 *
 * - `"cascade"` removes the item and its entire subtree.
 * - `"promote"` removes only the item, re-parenting its direct children to the
 *   item's parent (appended after that parent's existing children).
 */
export async function deleteChapter(
  id: ChapterId,
  mode: "cascade" | "promote",
): Promise<void> {
  const chapter = await db.chapters.get(id);
  if (!chapter) return;

  const all = await db.chapters
    .where({ projectId: chapter.projectId })
    .toArray();

  await db.transaction(
    "rw",
    [
      db.chapters,
      db.comments,
      db.chapterSnapshots,
      db.outlineGridRows,
      db.outlineGridCells,
    ],
    async () => {
      if (mode === "cascade") {
        for (const nodeId of subtreeIds(all, id)) {
          await deleteRowAndDependents(nodeId);
        }
        return;
      }

      // promote: re-parent direct children to this node's parent, appended
      // after that destination group's existing siblings.
      const newParentId = chapter.parentChapterId ?? null;
      const children = all
        .filter((c) => (c.parentChapterId ?? null) === id)
        .sort((a, b) => a.order - b.order);
      const destSiblings = all.filter(
        (c) =>
          c.id !== id &&
          c.section === chapter.section &&
          (c.parentChapterId ?? null) === newParentId,
      );
      let nextOrder =
        destSiblings.length === 0
          ? 0
          : Math.max(...destSiblings.map((c) => c.order)) + 1;
      for (const child of children) {
        await db.chapters.update(child.id, {
          parentChapterId: newParentId,
          order: nextOrder++,
          updatedAt: now(),
        });
      }
      await deleteRowAndDependents(id);
    },
  );
}
