import {
  createComment,
  deleteComment,
  resolveComment,
  updateComment,
} from "@/db/operations";
import type { ChapterId, Comment, CommentId, ProjectId } from "@/db/schemas";
import type { CommentInput, CommentPatch, CommentsAdapter } from "./adapter";

interface DexieAdapterOptions {
  projectId: ProjectId;
  chapterId: ChapterId;
  /** Live snapshot of comments for this chapter (from useLiveQuery). */
  comments: Comment[];
}

/**
 * Adapter that talks directly to the Dexie comments table. Used outside of
 * collab sessions; behaves identically to the original direct-import flow.
 */
export class DexieCommentsAdapter implements CommentsAdapter {
  readonly canCreate = true;
  readonly canEdit = true;
  readonly canResolve = true;
  readonly canDelete = true;

  constructor(private readonly opts: DexieAdapterOptions) {}

  get comments(): Comment[] {
    return this.opts.comments;
  }

  async create(input: CommentInput): Promise<CommentId> {
    const created = await createComment({
      projectId: this.opts.projectId,
      chapterId: this.opts.chapterId,
      fromOffset: input.fromOffset,
      toOffset: input.toOffset,
      anchorText: input.anchorText,
      content: input.content,
      color: input.color,
      author: input.author,
      authorColor: input.authorColor,
    });
    return created.id;
  }

  async update(id: CommentId, patch: CommentPatch): Promise<void> {
    await updateComment(id, patch);
  }

  async resolve(id: CommentId): Promise<void> {
    await resolveComment(id);
  }

  async remove(id: CommentId): Promise<void> {
    await deleteComment(id);
  }
}
