import { Editor } from "@tiptap/core";
import { createExtensions } from "@/components/editor/extensions";
import { db } from "@/db/database";
import {
  createChapter,
  deleteScene,
  getScenesByChapter,
  moveScene,
  reorderScenes,
  updateChapterContent,
} from "@/db/operations";
import type { ChapterId, Comment, CommentId, SceneId } from "@/db/schemas";
import { selectActiveChapterId, useEditorStore } from "@/store/editorStore";
import {
  assembleSegments,
  mapSegmentsToScenes,
  type OrderedSegment,
  resolveCoreId,
} from "./segments";

// ─── Model-D scene structural operations ─────────────────────────────
//
// A chapter is one markdown document; scenes are delimited by sceneBreak
// markers. Moving/reordering/promoting/deleting a scene therefore edits the
// chapter's content string AND the Scene rows AND re-anchors the comments that
// lived in the affected scenes. Content is carved with the pure segment helpers
// (segments.ts); comment offsets — ProseMirror positions — are remapped by
// parsing the before/after content into a headless editor and preserving each
// comment's offset relative to its scene's content start (scenes move intact,
// so the relative offset is invariant).

/** Run `fn` against a throwaway editor holding `content`, then dispose it. */
function withDoc<T>(content: string, fn: (editor: Editor) => T): T {
  const editor = new Editor({ extensions: createExtensions(), content });
  try {
    return fn(editor);
  } finally {
    editor.destroy();
  }
}

interface SceneBounds {
  sceneId: string;
  /** PM position of the scene's content start (after its marker; 0 for core). */
  start: number;
  /** PM position of the scene's content end (next marker start, or doc end). */
  end: number;
}

/** Content-boundary of each scene in a parsed chapter doc, core resolved. */
function computeBounds(editor: Editor, coreId: string): SceneBounds[] {
  const markers: { start: number; end: number; sceneId: string }[] = [];
  editor.state.doc.forEach((node, offset) => {
    if (node.type.name === "sceneBreak") {
      markers.push({
        start: offset,
        end: offset + node.nodeSize,
        sceneId: (node.attrs.sceneId as string | null) ?? "",
      });
    }
  });
  const size = editor.state.doc.content.size;
  const bounds: SceneBounds[] = [
    { sceneId: coreId, start: 0, end: markers[0]?.start ?? size },
  ];
  for (let i = 0; i < markers.length; i++) {
    bounds.push({
      sceneId: markers[i].sceneId,
      start: markers[i].end,
      end: markers[i + 1]?.start ?? size,
    });
  }
  return bounds;
}

function wordCountOf(editor: Editor): number {
  return (
    editor.storage as unknown as { characterCount: { words: () => number } }
  ).characterCount.words();
}

/** Where a scene lives after an operation: its chapter and new content bounds. */
type Locator = (
  sceneId: string,
) => { chapterId: ChapterId; bounds: SceneBounds } | null;

interface CommentWrite {
  id: CommentId;
  chapterId: ChapterId;
  fromOffset: number;
  toOffset: number;
}

/**
 * Remap one comment from its old scene bounds to wherever that scene now is.
 * Returns a write, `"delete"` when the scene was removed, or null when the
 * comment can't be bucketed (leave it untouched).
 */
function remapComment(
  comment: Comment,
  oldBounds: SceneBounds[],
  locate: Locator,
): CommentWrite | "delete" | null {
  const ob = oldBounds.filter((b) => b.start <= comment.fromOffset).pop();
  if (!ob) return null;
  const loc = locate(ob.sceneId);
  if (!loc) return "delete";
  const relFrom = comment.fromOffset - ob.start;
  const relTo = comment.toOffset - ob.start;
  const { start, end } = loc.bounds;
  const from = Math.min(Math.max(start, start + relFrom), end);
  const to = Math.min(Math.max(from, start + relTo), end);
  return {
    id: comment.id,
    chapterId: loc.chapterId,
    fromOffset: from,
    toOffset: to,
  };
}

/** Apply a batch of comment writes/deletes in one transaction. */
async function applyCommentWrites(
  writes: (CommentWrite | { id: CommentId; delete: true })[],
): Promise<void> {
  if (writes.length === 0) return;
  const ts = new Date().toISOString();
  await db.transaction("rw", db.comments, async () => {
    for (const w of writes) {
      if ("delete" in w) {
        await db.comments.delete(w.id);
      } else {
        await db.comments.update(w.id, {
          chapterId: w.chapterId,
          fromOffset: w.fromOffset,
          toOffset: w.toOffset,
          updatedAt: ts,
        });
      }
    }
  });
}

/** Reseed the open editor from Dexie when the changed chapter is the active one. */
function reseedIfActive(...chapterIds: ChapterId[]): void {
  const state = useEditorStore.getState();
  const active = selectActiveChapterId(state);
  if (active && chapterIds.includes(active)) {
    // Cancel a pending autosave (it holds pre-op editor content), then bump the
    // content version so ChapterEditor re-seeds from the freshly written row.
    state.markSaved();
    state.bumpContentVersion();
  }
}

/**
 * Reorder the scenes of a chapter to `orderedSceneIds` (core-first). Rewrites
 * the chapter content, updates row order, and re-anchors comments.
 */
export async function reorderScenesInChapter(
  chapterId: ChapterId,
  orderedSceneIds: SceneId[],
): Promise<void> {
  const chapter = await db.chapters.get(chapterId);
  if (!chapter) return;
  const scenes = await getScenesByChapter(chapterId);
  const sceneIds = scenes.map((s) => s.id);
  const content = chapter.content;

  const mapped = mapSegmentsToScenes(content, sceneIds);
  const byId = new Map(mapped.map((seg) => [seg.sceneId, seg]));
  const reordered: OrderedSegment[] = orderedSceneIds
    .map((id) => byId.get(id))
    .filter((seg): seg is OrderedSegment => seg !== undefined);
  if (reordered.length !== mapped.length) return; // stale ids — bail safely

  const oldCore = resolveCoreId(sceneIds, content);
  const newContent = assembleSegments(reordered);
  const newCore = orderedSceneIds[0];

  const comments = await db.comments.where({ chapterId }).toArray();
  const { wc, newBounds } = withDoc(newContent, (ed) => ({
    wc: wordCountOf(ed),
    newBounds: computeBounds(ed, newCore),
  }));
  const oldBounds = withDoc(content, (ed) => computeBounds(ed, oldCore));
  const newBoundsById = new Map(newBounds.map((b) => [b.sceneId, b]));
  const locate: Locator = (sceneId) => {
    const b = newBoundsById.get(sceneId);
    return b ? { chapterId, bounds: b } : null;
  };
  const writes = comments
    .map((c) => remapComment(c, oldBounds, locate))
    .filter((w): w is CommentWrite => w !== null && w !== "delete");

  await updateChapterContent(chapterId, newContent, wc);
  await reorderScenes(chapterId, orderedSceneIds);
  await applyCommentWrites(writes);
  reseedIfActive(chapterId);
}

/**
 * Move a scene out of its chapter and into `targetChapterId`, inserting it
 * before `beforeSceneId` (or at the end). Rewrites both chapters' content,
 * moves the row and its metadata, and re-anchors the moved scene's comments to
 * the destination while re-anchoring the rest within the source.
 */
export async function moveSceneToChapter(
  sceneId: SceneId,
  targetChapterId: ChapterId,
  beforeSceneId: SceneId | null = null,
): Promise<void> {
  const scene = await db.scenes.get(sceneId);
  if (!scene) return;
  const sourceChapterId = scene.chapterId;
  if (sourceChapterId === targetChapterId) return;

  const [source, target] = await Promise.all([
    db.chapters.get(sourceChapterId),
    db.chapters.get(targetChapterId),
  ]);
  if (!source || !target) return;

  const sourceScenes = await getScenesByChapter(sourceChapterId);
  const targetScenes = await getScenesByChapter(targetChapterId);
  // Moving the source's only scene would empty it — disallow.
  if (sourceScenes.length <= 1) return;

  const sourceIds = sourceScenes.map((s) => s.id);
  const targetIds = targetScenes.map((s) => s.id);
  const oldSourceCore = resolveCoreId(sourceIds, source.content);
  const oldTargetCore = resolveCoreId(targetIds, target.content);

  const sourceSegs = mapSegmentsToScenes(source.content, sourceIds);
  const movedSeg = sourceSegs.find((s) => s.sceneId === sceneId);
  if (!movedSeg) return;
  const remainingSegs = sourceSegs.filter((s) => s.sceneId !== sceneId);

  const targetSegs = mapSegmentsToScenes(target.content, targetIds);
  const insertAt = beforeSceneId
    ? targetSegs.findIndex((s) => s.sceneId === beforeSceneId)
    : targetSegs.length;
  const targetWithMoved = [...targetSegs];
  targetWithMoved.splice(
    insertAt < 0 ? targetSegs.length : insertAt,
    0,
    movedSeg,
  );

  const newSource = assembleSegments(remainingSegs);
  const newTarget = assembleSegments(targetWithMoved);
  const newSourceCore = remainingSegs[0]?.sceneId ?? "";
  const newTargetCore = targetWithMoved[0]?.sceneId ?? "";

  const [sourceComments, targetComments] = await Promise.all([
    db.comments.where({ chapterId: sourceChapterId }).toArray(),
    db.comments.where({ chapterId: targetChapterId }).toArray(),
  ]);
  const oldSourceBounds = withDoc(source.content, (ed) =>
    computeBounds(ed, oldSourceCore),
  );
  const oldTargetBounds = withDoc(target.content, (ed) =>
    computeBounds(ed, oldTargetCore),
  );
  const { newSourceBounds, sourceWc } = withDoc(newSource, (ed) => ({
    newSourceBounds: computeBounds(ed, newSourceCore),
    sourceWc: wordCountOf(ed),
  }));
  const { newTargetBounds, targetWc } = withDoc(newTarget, (ed) => ({
    newTargetBounds: computeBounds(ed, newTargetCore),
    targetWc: wordCountOf(ed),
  }));
  const newSourceById = new Map(newSourceBounds.map((b) => [b.sceneId, b]));
  const newTargetById = new Map(newTargetBounds.map((b) => [b.sceneId, b]));
  // The moved scene lands in the target; every other scene keeps its chapter.
  const locate: Locator = (sid) => {
    if (sid === sceneId) {
      const b = newTargetById.get(sid);
      return b ? { chapterId: targetChapterId, bounds: b } : null;
    }
    const inSource = newSourceById.get(sid);
    if (inSource) return { chapterId: sourceChapterId, bounds: inSource };
    const inTarget = newTargetById.get(sid);
    return inTarget ? { chapterId: targetChapterId, bounds: inTarget } : null;
  };
  const writes = [
    ...sourceComments.map((c) => remapComment(c, oldSourceBounds, locate)),
    ...targetComments.map((c) => remapComment(c, oldTargetBounds, locate)),
  ].filter((w): w is CommentWrite => w !== null && w !== "delete");

  await updateChapterContent(sourceChapterId, newSource, sourceWc);
  await updateChapterContent(targetChapterId, newTarget, targetWc);
  await moveScene(sceneId, { chapterId: targetChapterId, beforeSceneId });
  await applyCommentWrites(writes);
  reseedIfActive(sourceChapterId, targetChapterId);
}

/**
 * Promote a scene into a brand-new chapter placed right after its current one.
 * The scene becomes the new chapter's core scene.
 */
export async function promoteSceneToChapter(
  sceneId: SceneId,
  untitledTitle: string,
): Promise<ChapterId | null> {
  const scene = await db.scenes.get(sceneId);
  if (!scene) return null;
  const source = await db.chapters.get(scene.chapterId);
  if (!source) return null;
  const sourceScenes = await getScenesByChapter(scene.chapterId);
  if (sourceScenes.length <= 1) return null; // don't strip a chapter's only scene

  // New sibling chapter directly after the source, same section.
  const newChapter = await createChapter({
    projectId: source.projectId,
    title: untitledTitle,
    section: source.section,
    order: source.order + 1,
  });
  // createChapter seeds an (empty) core scene; drop it — the promoted scene
  // becomes this chapter's sole/core scene.
  const seeded = await getScenesByChapter(newChapter.id);
  for (const s of seeded) await deleteScene(s.id);

  await moveSceneToChapter(sceneId, newChapter.id);
  return newChapter.id;
}

/**
 * Delete a scene: remove its prose segment, marker, row, and any comments that
 * lived inside it, then re-anchor the surviving comments. Refuses to delete a
 * chapter's only scene.
 */
export async function deleteSceneWithContent(sceneId: SceneId): Promise<void> {
  const scene = await db.scenes.get(sceneId);
  if (!scene) return;
  const chapterId = scene.chapterId;
  const chapter = await db.chapters.get(chapterId);
  if (!chapter) return;
  const scenes = await getScenesByChapter(chapterId);
  if (scenes.length <= 1) return;

  const sceneIds = scenes.map((s) => s.id);
  const oldCore = resolveCoreId(sceneIds, chapter.content);
  const segs = mapSegmentsToScenes(chapter.content, sceneIds);
  const remaining = segs.filter((s) => s.sceneId !== sceneId);
  const newContent = assembleSegments(remaining);
  const newCore = remaining[0]?.sceneId ?? "";

  const comments = await db.comments.where({ chapterId }).toArray();
  const oldBounds = withDoc(chapter.content, (ed) =>
    computeBounds(ed, oldCore),
  );
  const { newBounds, wc } = withDoc(newContent, (ed) => ({
    newBounds: computeBounds(ed, newCore),
    wc: wordCountOf(ed),
  }));
  const newById = new Map(newBounds.map((b) => [b.sceneId, b]));
  const locate: Locator = (sid) => {
    const b = newById.get(sid);
    return b ? { chapterId, bounds: b } : null;
  };
  const writes: (CommentWrite | { id: CommentId; delete: true })[] = [];
  for (const c of comments) {
    const r = remapComment(c, oldBounds, locate);
    if (r === "delete") writes.push({ id: c.id, delete: true });
    else if (r) writes.push(r);
  }

  await updateChapterContent(chapterId, newContent, wc);
  await deleteScene(sceneId);
  await applyCommentWrites(writes);
  reseedIfActive(chapterId);
}
