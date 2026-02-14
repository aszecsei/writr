import type { Editor } from "@tiptap/react";
import type { MutableRefObject, RefObject } from "react";
import { useEffect, useMemo, useRef } from "react";
import { COMMENTS_UPDATED_META } from "@/components/editor/extensions/Comments";
import { updateComment } from "@/db/operations";
import type { Comment } from "@/db/schemas";
import { reconcileComment } from "@/lib/comments/reconcile";

/**
 * Synchronizes comment data with the TipTap editor:
 * 1. Keeps commentsRef in sync with active (non-resolved) comments.
 * 2. Dispatches COMMENTS_UPDATED_META to rebuild decorations when comments change.
 * 3. Reconciles comment positions on chapter load (runs once per content initialization).
 */
export function useEditorCommentSync(
  editor: Editor | null,
  comments: Comment[] | undefined,
  commentsRef: MutableRefObject<Comment[]>,
  initializedRef: RefObject<boolean>,
) {
  const reconcileRunRef = useRef(false);

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

  // Reconcile comment positions on chapter load
  useEffect(() => {
    if (
      !editor ||
      editor.isDestroyed ||
      !comments ||
      !initializedRef.current ||
      reconcileRunRef.current
    )
      return;
    reconcileRunRef.current = true;

    const doc = editor.state.doc;
    const plainText = doc.textBetween(1, doc.content.size, "\n");

    for (const comment of comments) {
      if (comment.status === "resolved") continue;

      const result = reconcileComment(comment, plainText);

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
    }
  }, [editor, comments, initializedRef]);

  // Reset reconciliation flag when called hook is reset externally
  const resetReconcile = () => {
    reconcileRunRef.current = false;
  };

  return { activeComments, resetReconcile };
}
