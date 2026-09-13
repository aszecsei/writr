import type { Editor } from "@tiptap/react";
import type { MutableRefObject, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COMMENTS_UPDATED_META } from "@/components/editor/extensions/Comments";
import { updateComment } from "@/db/operations";
import type { Comment, CommentId } from "@/db/schemas";
import { reconcileComment } from "@/lib/comments/reconcile";

/**
 * Synchronizes comment data with the TipTap editor:
 * 1. Keeps commentsRef in sync with active (non-resolved) comments.
 * 2. Dispatches COMMENTS_UPDATED_META to rebuild decorations when comments change.
 * 3. Reconciles each comment's position the first time it's seen this
 *    session. New comments injected into Dexie at runtime — notably by the
 *    AI `add_comment` tool, which writes placeholder offsets and depends
 *    on doc-aware reconciliation to land highlights on the right span —
 *    are reconciled when their liveQuery emission lands. Comments already
 *    reconciled in this session are skipped, so reconcile-then-emit doesn't
 *    loop.
 */
export function useEditorCommentSync(
  editor: Editor | null,
  comments: Comment[] | undefined,
  commentsRef: MutableRefObject<Comment[]>,
  initializedRef: RefObject<boolean>,
) {
  const reconciledIdsRef = useRef<Set<CommentId>>(new Set());
  // Bumped by resetReconcile so the reconcile effect re-runs against the
  // current document even when `comments` hasn't changed (same-chapter reseed).
  const [reconcileEpoch, setReconcileEpoch] = useState(0);

  const activeComments = useMemo(() => {
    return (comments ?? []).filter((c) => c.status !== "resolved");
  }, [comments]);

  // Update the comments ref and force ProseMirror to re-render decorations.
  useEffect(() => {
    commentsRef.current = activeComments;
    if (editor && !editor.isDestroyed && initializedRef.current) {
      const tr = editor.state.tr.setMeta(COMMENTS_UPDATED_META, true);
      editor.view.dispatch(tr);
    }
  }, [activeComments, editor, commentsRef, initializedRef]);

  // Reconcile any comments we haven't seen yet this session.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reconcileEpoch forces a re-run after a reset
  useEffect(() => {
    if (!editor || editor.isDestroyed || !comments || !initializedRef.current)
      return;

    const doc = editor.state.doc;
    const plainText = doc.textBetween(1, doc.content.size, "\n");

    for (const comment of comments) {
      if (comment.status === "resolved") continue;
      if (reconciledIdsRef.current.has(comment.id)) continue;

      const result = reconcileComment(comment, plainText, doc);

      if (!result.found) {
        if (comment.status !== "orphaned") {
          updateComment(comment.id, { status: "orphaned" });
        }
      } else if (result.newFrom !== undefined && result.newTo !== undefined) {
        updateComment(comment.id, {
          fromOffset: result.newFrom,
          toOffset: result.newTo,
          status: "active",
        });
      } else if (comment.status === "orphaned") {
        updateComment(comment.id, { status: "active" });
      }

      reconciledIdsRef.current.add(comment.id);
    }
  }, [editor, comments, initializedRef, reconcileEpoch]);

  // Forget what has been reconciled and re-run against the current document.
  // Called after a chapter switch or any whole-document replacement.
  const resetReconcile = useCallback(() => {
    reconciledIdsRef.current = new Set();
    setReconcileEpoch((e) => e + 1);
  }, []);

  return { activeComments, resetReconcile };
}
