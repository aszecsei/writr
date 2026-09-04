import { db } from "../database";
import {
  type ChapterId,
  type CommentId,
  type Scene,
  type SceneId,
  SceneSchema,
} from "../schemas";
import { generateId, now, stripUndefined } from "./helpers";

// ─── Scenes ──────────────────────────────────────────────────────────
//
// Model D: a Scene row holds identity, ordering, and metadata only. A chapter's
// prose lives in its single TipTap document; scenes are delimited there by
// `sceneBreak` marker nodes. The marker↔row sync engine (in the editor layer)
// keeps rows aligned with markers on save; these operations are the row-level
// primitives that engine and the sidebar call.

/** A chapter's scenes in order. order 0 is always the core scene. */
export async function getScenesByChapter(
  chapterId: ChapterId,
): Promise<Scene[]> {
  return db.scenes.where({ chapterId }).sortBy("order");
}

export async function getScene(id: SceneId): Promise<Scene | undefined> {
  return db.scenes.get(id);
}

/**
 * Next order for a scene appended to a chapter: max existing order + 1, or 0
 * when the chapter has no scenes yet (the first, core scene).
 */
export async function nextSceneOrder(chapterId: ChapterId): Promise<number> {
  const scenes = await db.scenes.where({ chapterId }).toArray();
  if (scenes.length === 0) return 0;
  return Math.max(...scenes.map((s) => s.order)) + 1;
}

export async function createScene(
  data: Pick<Scene, "projectId" | "chapterId"> &
    Partial<
      Pick<
        Scene,
        | "id"
        | "order"
        | "title"
        | "status"
        | "povCharacterId"
        | "presentCharacterIds"
        | "locationIds"
        | "timelineMode"
        | "strands"
        | "storyDate"
        | "storyTime"
        | "targetWordCount"
        | "wordCount"
        | "tags"
      >
    >,
): Promise<Scene> {
  // The insert-time path mints the sceneId first (so the marker node attr and
  // the row agree), passing it in via `data.id`. Otherwise generate one.
  const order = data.order ?? (await nextSceneOrder(data.chapterId));
  const scene = SceneSchema.parse({
    id: data.id ?? generateId(),
    projectId: data.projectId,
    chapterId: data.chapterId,
    order,
    title: data.title ?? "",
    status: data.status ?? "draft",
    povCharacterId: data.povCharacterId ?? null,
    presentCharacterIds: data.presentCharacterIds ?? [],
    locationIds: data.locationIds ?? [],
    timelineMode: data.timelineMode ?? "linear",
    strands: data.strands ?? [],
    storyDate: data.storyDate ?? "",
    storyTime: data.storyTime ?? "",
    targetWordCount: data.targetWordCount ?? 0,
    wordCount: data.wordCount ?? 0,
    tags: data.tags ?? [],
    createdAt: now(),
    updatedAt: now(),
  });
  await db.scenes.add(scene);
  return scene;
}

/** Update a scene's author-editable metadata (never prose — there is none). */
export async function updateScene(
  id: SceneId,
  data: Partial<
    Pick<
      Scene,
      | "title"
      | "status"
      | "povCharacterId"
      | "presentCharacterIds"
      | "locationIds"
      | "timelineMode"
      | "strands"
      | "storyDate"
      | "storyTime"
      | "targetWordCount"
      | "tags"
    >
  >,
): Promise<void> {
  await db.scenes.update(id, { ...stripUndefined(data), updatedAt: now() });
}

/**
 * Batch-write derived per-scene word counts in one transaction (one live-query
 * notification). Rows whose count is unchanged are skipped, mirroring how
 * comment-position updates avoid no-op writes.
 */
export async function updateSceneWordCounts(
  counts: Map<SceneId, number>,
): Promise<void> {
  const ids = [...counts.keys()];
  if (ids.length === 0) return;
  await db.transaction("rw", db.scenes, async () => {
    const existing = await db.scenes.bulkGet(ids);
    const ts = now();
    for (const scene of existing) {
      if (!scene) continue;
      const next = counts.get(scene.id);
      if (next === undefined || next === scene.wordCount) continue;
      await db.scenes.update(scene.id, { wordCount: next, updatedAt: ts });
    }
  });
}

/** Delete a scene row. Remaining scenes are renumbered to stay contiguous. */
export async function deleteScene(id: SceneId): Promise<void> {
  const scene = await db.scenes.get(id);
  if (!scene) return;
  await db.transaction("rw", db.scenes, async () => {
    await db.scenes.delete(id);
    await renumberChapterScenes(scene.chapterId);
  });
}

/** Renumber a chapter's scenes to a contiguous 0..N-1 in current order. */
async function renumberChapterScenes(chapterId: ChapterId): Promise<void> {
  const scenes = await db.scenes.where({ chapterId }).sortBy("order");
  const ts = now();
  for (let i = 0; i < scenes.length; i++) {
    if (scenes[i].order !== i) {
      await db.scenes.update(scenes[i].id, { order: i, updatedAt: ts });
    }
  }
}

/** Reorder a chapter's scenes to match `orderedSceneIds`. */
export async function reorderScenes(
  chapterId: ChapterId,
  orderedSceneIds: SceneId[],
): Promise<void> {
  await db.transaction("rw", db.scenes, async () => {
    const ts = now();
    for (let i = 0; i < orderedSceneIds.length; i++) {
      await db.scenes.update(orderedSceneIds[i], { order: i, updatedAt: ts });
    }
    await renumberChapterScenes(chapterId);
  });
}

/**
 * Move a scene to another chapter (or a new position within its own), then
 * renumber both affected scene groups. The prose slice surgery — cutting the
 * doc content between markers in the source chapter and splicing it into the
 * destination — happens in the editor/sidebar layer, NOT here. This operation
 * handles only the row move and comment re-anchoring: `commentRebase` carries
 * the precomputed new anchors for comments that lived inside the moved slice
 * (their `chapterId` changes and their offsets shift), applied in the same
 * transaction so the row move and comment move commit together.
 */
export async function moveScene(
  sceneId: SceneId,
  target: { chapterId: ChapterId; beforeSceneId?: SceneId | null },
  commentRebase?: Array<{
    commentId: CommentId;
    chapterId: ChapterId;
    fromOffset: number;
    toOffset: number;
  }>,
): Promise<void> {
  const scene = await db.scenes.get(sceneId);
  if (!scene) throw new Error(`moveScene: scene not found: ${sceneId}`);

  const sourceChapterId = scene.chapterId;
  const destChapterId = target.chapterId;

  await db.transaction("rw", db.scenes, db.comments, async () => {
    // Order the moved scene into the destination group.
    const destScenes = (
      await db.scenes.where({ chapterId: destChapterId }).sortBy("order")
    ).filter((s) => s.id !== sceneId);

    const orderedIds: SceneId[] = [];
    let inserted = false;
    for (const s of destScenes) {
      if (target.beforeSceneId && s.id === target.beforeSceneId) {
        orderedIds.push(sceneId);
        inserted = true;
      }
      orderedIds.push(s.id);
    }
    if (!inserted) orderedIds.push(sceneId);

    const ts = now();
    await db.scenes.update(sceneId, {
      chapterId: destChapterId,
      updatedAt: ts,
    });
    for (let i = 0; i < orderedIds.length; i++) {
      await db.scenes.update(orderedIds[i], { order: i, updatedAt: ts });
    }
    if (sourceChapterId !== destChapterId) {
      await renumberChapterScenes(sourceChapterId);
    }

    for (const rebase of commentRebase ?? []) {
      await db.comments.update(rebase.commentId, {
        chapterId: rebase.chapterId,
        fromOffset: rebase.fromOffset,
        toOffset: rebase.toOffset,
        updatedAt: ts,
      });
    }
  });
}
