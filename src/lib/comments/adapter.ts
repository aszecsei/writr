import type { Comment, CommentColor, CommentStatus } from "@/db/schemas";

/**
 * Input for creating a new comment. Both solo and collab modes share this
 * shape; chapter / project scoping is bound to the adapter at construction.
 */
export interface CommentInput {
  fromOffset: number;
  toOffset: number;
  anchorText?: string;
  content?: string;
  color?: CommentColor;
  author?: string;
  authorColor?: string;
}

export interface CommentPatch {
  content?: string;
  color?: CommentColor;
  status?: CommentStatus;
  resolvedAt?: string | null;
  fromOffset?: number;
  toOffset?: number;
  anchorText?: string;
}

/**
 * Backend-agnostic interface for the comment-margin UI.
 *
 * Solo mode → DexieCommentsAdapter (writes directly to IndexedDB).
 * Collab mode → YjsCommentsAdapter (writes to a shared Y.Doc; the host
 * mirrors mutations back to Dexie via Y.Map.observe so comments persist
 * after the session ends).
 */
export interface CommentsAdapter {
  /** Active + orphaned comments (resolved excluded). Snapshot per render. */
  readonly comments: Comment[];
  /** UI permissions — drive role-gated affordances. */
  readonly canCreate: boolean;
  readonly canEdit: boolean;
  readonly canResolve: boolean;
  readonly canDelete: boolean;
  create(input: CommentInput): Promise<string>;
  update(id: string, patch: CommentPatch): Promise<void>;
  resolve(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}
