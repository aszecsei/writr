import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../database";
import type { ChapterId, ProjectId } from "../schemas";
import {
  createComment,
  deleteComment,
  getComment,
  resolveComment,
} from "./comments";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const chapterId = "b1111111-1111-4111-a111-111111111111" as ChapterId;

beforeEach(async () => {
  await db.comments.clear();
});

describe("resolveComment", () => {
  it("resolves a comment", async () => {
    const comment = await createComment({
      projectId,
      chapterId,
      fromOffset: 0,
      toOffset: 10,
    });

    await resolveComment(comment.id);

    const resolved = await getComment(comment.id);
    expect(resolved?.status).toBe("resolved");
    expect(resolved?.resolvedAt).not.toBeNull();
  });
});

describe("deleteComment (reply cascade)", () => {
  it("deletes a root comment together with its replies", async () => {
    const root = await createComment({
      projectId,
      chapterId,
      fromOffset: 0,
      toOffset: 10,
    });
    const reply = await createComment({
      projectId,
      chapterId,
      fromOffset: 0,
      toOffset: 10,
      parentCommentId: root.id,
    });

    await deleteComment(root.id);

    expect(await getComment(root.id)).toBeUndefined();
    expect(await getComment(reply.id)).toBeUndefined();
  });

  it("deletes only the given reply, leaving its root and siblings intact", async () => {
    const root = await createComment({
      projectId,
      chapterId,
      fromOffset: 0,
      toOffset: 10,
    });
    const replyToDelete = await createComment({
      projectId,
      chapterId,
      fromOffset: 0,
      toOffset: 10,
      parentCommentId: root.id,
    });
    const replyToKeep = await createComment({
      projectId,
      chapterId,
      fromOffset: 0,
      toOffset: 10,
      parentCommentId: root.id,
    });

    await deleteComment(replyToDelete.id);

    expect(await getComment(replyToDelete.id)).toBeUndefined();
    expect(await getComment(root.id)).toBeDefined();
    expect(await getComment(replyToKeep.id)).toBeDefined();
  });
});
