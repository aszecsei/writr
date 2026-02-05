import { db } from "../database";
import { type Comment, CommentSchema } from "../schemas";
import { generateId, now } from "./helpers";

// ─── Comments ────────────────────────────────────────────────────────

export async function getCommentsByChapter(
  chapterId: string,
): Promise<Comment[]> {
  return db.comments.where({ chapterId }).sortBy("fromOffset");
}

export async function getComment(id: string): Promise<Comment | undefined> {
  return db.comments.get(id);
}

export async function createComment(
  data: Pick<Comment, "projectId" | "chapterId" | "fromOffset" | "toOffset"> &
    Partial<Pick<Comment, "content" | "color" | "anchorText" | "status">>,
): Promise<Comment> {
  const comment = CommentSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    chapterId: data.chapterId,
    content: data.content ?? "",
    color: data.color ?? "yellow",
    fromOffset: data.fromOffset,
    toOffset: data.toOffset,
    anchorText: data.anchorText ?? "",
    status: data.status ?? "active",
    resolvedAt: null,
    createdAt: now(),
    updatedAt: now(),
  });
  await db.comments.add(comment);
  return comment;
}

export async function updateComment(
  id: string,
  data: Partial<
    Pick<
      Comment,
      | "content"
      | "color"
      | "fromOffset"
      | "toOffset"
      | "anchorText"
      | "status"
      | "resolvedAt"
    >
  >,
): Promise<void> {
  await db.comments.update(id, { ...data, updatedAt: now() });
}

export async function resolveComment(id: string): Promise<void> {
  await db.comments.update(id, {
    status: "resolved",
    resolvedAt: now(),
    updatedAt: now(),
  });
}

export async function deleteComment(id: string): Promise<void> {
  await db.comments.delete(id);
}

function buildCommentUpdates(
  comments: (Comment | undefined)[],
  positionMap: Map<string, { from: number; to: number }>,
): { key: string; changes: Record<string, unknown> }[] {
  const updates: { key: string; changes: Record<string, unknown> }[] = [];

  for (const comment of comments) {
    if (!comment) continue;
    const mapped = positionMap.get(comment.id);
    if (!mapped) continue;

    const changes: Record<string, unknown> = {};
    let changed = false;

    if (comment.fromOffset !== mapped.from) {
      changes.fromOffset = mapped.from;
      changed = true;
    }
    if (comment.toOffset !== mapped.to) {
      changes.toOffset = mapped.to;
      changed = true;
    }

    const wasRange = comment.fromOffset < comment.toOffset;
    const isNowPoint = mapped.from === mapped.to;
    if (wasRange && isNowPoint && comment.status === "active") {
      changes.status = "orphaned";
      changed = true;
    }

    if (changed) {
      changes.updatedAt = new Date().toISOString();
      updates.push({ key: comment.id, changes });
    }
  }

  return updates;
}

/**
 * Batch-update comment positions from the editor's position map.
 * Runs in a single Dexie transaction (one live-query notification).
 * Only writes when fromOffset/toOffset actually changed.
 * Marks previously-ranged comments as "orphaned" if their range collapsed.
 */
export async function updateCommentPositions(
  positionMap: Map<string, { from: number; to: number }>,
): Promise<void> {
  if (positionMap.size === 0) return;

  const ids = [...positionMap.keys()];
  const comments = await db.comments.bulkGet(ids);
  const updates = buildCommentUpdates(comments, positionMap);

  if (updates.length === 0) return;

  await db.transaction("rw", db.comments, async () => {
    for (const { key, changes } of updates) {
      await db.comments.update(key, changes);
    }
  });
}
