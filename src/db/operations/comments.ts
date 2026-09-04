import { db } from "../database";
import { type Comment, type CommentId, CommentSchema } from "../schemas";
import { createCrud, generateId, now, stripUndefined } from "./helpers";

// ─── Comments ────────────────────────────────────────────────────────

export const getComment = createCrud<Comment, CommentId>(db.comments).get;

export async function createComment(
  data: Pick<Comment, "projectId" | "chapterId" | "fromOffset" | "toOffset"> &
    Partial<
      Pick<
        Comment,
        | "content"
        | "color"
        | "anchorText"
        | "status"
        | "author"
        | "authorColor"
        | "parentCommentId"
      >
    >,
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
    author: data.author,
    authorColor: data.authorColor,
    parentCommentId: data.parentCommentId ?? null,
    createdAt: now(),
    updatedAt: now(),
  });
  await db.comments.add(comment);
  return comment;
}

export async function updateComment(
  id: CommentId,
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
      | "author"
      | "authorColor"
    >
  >,
): Promise<void> {
  await db.comments.update(id, { ...stripUndefined(data), updatedAt: now() });
}

export async function resolveComment(id: CommentId): Promise<void> {
  await db.comments.update(id, {
    status: "resolved",
    resolvedAt: now(),
    updatedAt: now(),
  });
}

/**
 * Delete a comment. If the comment is a root with replies, all replies are
 * deleted in the same transaction (cascade). Deleting a reply removes only
 * that reply.
 */
export async function deleteComment(id: CommentId): Promise<void> {
  await db.transaction("rw", db.comments, async () => {
    const replyIds = await db.comments
      .where("parentCommentId")
      .equals(id)
      .primaryKeys();
    if (replyIds.length > 0) {
      await db.comments.bulkDelete(replyIds);
    }
    await db.comments.delete(id);
  });
}

function buildCommentUpdates(
  comments: (Comment | undefined)[],
  positionMap: Map<CommentId, { from: number; to: number }>,
): { key: CommentId; changes: Record<string, unknown> }[] {
  const updates: { key: CommentId; changes: Record<string, unknown> }[] = [];

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
      changes.updatedAt = now();
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
 *
 * Replies are not tracked by the editor (they have no visible anchor of
 * their own), so they don't appear in `positionMap`. This function expands
 * the map: for every root being moved, all of its replies inherit the new
 * position. Orphan-on-collapse only applies to roots — a reply's status is
 * not changed here.
 */
export async function updateCommentPositions(
  positionMap: Map<CommentId, { from: number; to: number }>,
): Promise<void> {
  if (positionMap.size === 0) return;

  const rootIds = [...positionMap.keys()];
  const roots = await db.comments.bulkGet(rootIds);
  const rootUpdates = buildCommentUpdates(roots, positionMap);

  const replyUpdates: { key: CommentId; changes: Record<string, unknown> }[] =
    [];
  const replies = await db.comments
    .where("parentCommentId")
    .anyOf(rootIds)
    .toArray();
  const timestamp = now();
  for (const reply of replies) {
    if (reply.parentCommentId === null) continue;
    const rootPos = positionMap.get(reply.parentCommentId);
    if (!rootPos) continue;
    const changes: Record<string, unknown> = {};
    let changed = false;
    if (reply.fromOffset !== rootPos.from) {
      changes.fromOffset = rootPos.from;
      changed = true;
    }
    if (reply.toOffset !== rootPos.to) {
      changes.toOffset = rootPos.to;
      changed = true;
    }
    if (changed) {
      changes.updatedAt = timestamp;
      replyUpdates.push({ key: reply.id, changes });
    }
  }

  if (rootUpdates.length === 0 && replyUpdates.length === 0) return;

  await db.transaction("rw", db.comments, async () => {
    for (const { key, changes } of rootUpdates) {
      await db.comments.update(key, changes);
    }
    for (const { key, changes } of replyUpdates) {
      await db.comments.update(key, changes);
    }
  });
}
