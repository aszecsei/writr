"use client";

import type { Editor } from "@tiptap/react";
import { Check, Trash2, X } from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Comment, CommentColor } from "@/db/schemas";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useCommentStore } from "@/store/commentStore";
import { getCommentPositions } from "../extensions/Comments";
import { useCommentsAdapter } from "./CommentsAdapterContext";
import {
  CARD_BORDER_COLOR,
  COLOR_BUTTON_CLASSES,
  COMMENT_COLORS,
} from "./colors";
import { calculateCommentTop } from "./position";

interface CommentPopoverProps {
  editor: Editor | null;
  comments: Comment[];
}

export function CommentPopover({ editor, comments }: CommentPopoverProps) {
  const adapter = useCommentsAdapter();
  const selectedId = useCommentStore((s) => s.selectedId);
  const selectComment = useCommentStore((s) => s.selectComment);
  const clearSelection = useCommentStore((s) => s.clearSelection);
  const [position, setPosition] = useState<{ top: number } | null>(null);
  const [content, setContent] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedComment = comments.find((c) => c.id === selectedId);

  // The root anchors the popover position and owns the reply composer.
  // If the user selected a reply, we still pin the popover to its root's
  // position (replies inherit position) but the textarea above continues to
  // edit the selected comment — root or reply.
  const rootComment = useMemo<Comment | undefined>(() => {
    if (!selectedComment) return undefined;
    if (selectedComment.parentCommentId === null) return selectedComment;
    return comments.find((c) => c.id === selectedComment.parentCommentId);
  }, [selectedComment, comments]);

  const replies = useMemo<Comment[]>(() => {
    if (!rootComment) return [];
    return comments
      .filter((c) => c.parentCommentId === rootComment.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [comments, rootComment]);

  // Update local content when selection changes
  useEffect(() => {
    if (selectedComment) {
      setContent(selectedComment.content);
    } else {
      setContent("");
    }
    setReplyDraft("");
  }, [selectedComment]);

  // Calculate popover position from the root (replies inherit position).
  useEffect(() => {
    if (!editor || editor.isDestroyed || !rootComment) {
      setPosition(null);
      return;
    }

    const positionMap = getCommentPositions(editor.view.state);
    const top = calculateCommentTop(editor.view, rootComment, positionMap);
    setPosition(top !== null ? { top: top - 10 } : null);
  }, [editor, rootComment]);

  // Focus textarea when popover opens
  useEffect(() => {
    if (position && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [position]);

  // Close on click outside or Escape, saving unsaved content first
  const handleDismiss = useCallback(() => {
    if (
      adapter.canEdit &&
      selectedId &&
      selectedComment &&
      content !== selectedComment.content
    ) {
      adapter.update(selectedId, { content });
    }
    clearSelection();
  }, [adapter, selectedId, selectedComment, content, clearSelection]);

  useClickOutside(popoverRef, handleDismiss, !!selectedId);

  const handleColorChange = useCallback(
    async (color: CommentColor) => {
      if (!selectedId || !adapter.canEdit) return;
      await adapter.update(selectedId, { color });
    },
    [adapter, selectedId],
  );

  const handleResolve = useCallback(async () => {
    if (!rootComment || !adapter.canResolve) return;
    // Resolving a thread always targets the root; replies hide with it.
    await adapter.resolve(rootComment.id);
    clearSelection();
  }, [adapter, rootComment, clearSelection]);

  const handleDelete = useCallback(async () => {
    if (!selectedId || !adapter.canDelete) return;
    await adapter.remove(selectedId);
    clearSelection();
  }, [adapter, selectedId, clearSelection]);

  const handleContentBlur = useCallback(async () => {
    if (!selectedId || !selectedComment || !adapter.canEdit) return;
    if (content !== selectedComment.content) {
      await adapter.update(selectedId, { content });
    }
  }, [adapter, selectedId, selectedComment, content]);

  const handleReplySubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!rootComment || !adapter.canCreate) return;
      const text = replyDraft.trim();
      if (text.length === 0) return;
      await adapter.create({
        fromOffset: rootComment.fromOffset,
        toOffset: rootComment.toOffset,
        anchorText: rootComment.anchorText,
        content: text,
        color: rootComment.color,
        parentCommentId: rootComment.id,
      });
      setReplyDraft("");
    },
    [adapter, rootComment, replyDraft],
  );

  if (!selectedComment || !rootComment || !position) {
    return null;
  }

  const isReplySelected = selectedComment.parentCommentId !== null;

  return (
    <div
      ref={popoverRef}
      className={`absolute z-50 w-72 rounded-lg border border-l-2 bg-white p-3 shadow-lg dark:bg-neutral-800 ${
        CARD_BORDER_COLOR[rootComment.color]
      } border-neutral-200 dark:border-neutral-700`}
      style={{
        top: position.top,
        // Position near the small indicators: just past the right edge of content
        left: "calc(50% + var(--editor-content-width) / 2 + 2.5rem)",
      }}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {isReplySelected ? "Reply" : "Comment"}
          {replies.length > 0 && !isReplySelected && (
            <span className="ml-1.5 text-neutral-400 dark:text-neutral-500">
              · {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={clearSelection}
          className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
        >
          <X size={14} />
        </button>
      </div>

      {/* When a reply is selected, show the root above as read-only context. */}
      {isReplySelected && (
        <button
          type="button"
          onClick={() => selectComment(rootComment.id)}
          className="mb-3 block w-full rounded border border-neutral-200 bg-neutral-50 p-2 text-left text-xs text-neutral-600 hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-600"
        >
          {rootComment.author && (
            <CommentAuthorByline
              author={rootComment.author}
              authorColor={rootComment.authorColor}
            />
          )}
          <p className="line-clamp-3 whitespace-pre-wrap">
            {rootComment.content || "(empty)"}
          </p>
        </button>
      )}

      {/* Author byline for the focused comment (root or selected reply). */}
      {selectedComment.author && (
        <CommentAuthorByline
          author={selectedComment.author}
          authorColor={selectedComment.authorColor}
        />
      )}

      {/* Content textarea — edits the focused comment (root or reply). */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleContentBlur}
        readOnly={!adapter.canEdit}
        placeholder={adapter.canEdit ? "Add a comment..." : ""}
        className="mb-3 h-20 w-full resize-none rounded border border-neutral-200 bg-neutral-50 p-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500"
      />

      {/* Color picker — only on the root; replies inherit color visually. */}
      {!isReplySelected && adapter.canEdit && (
        <div className="mb-3 flex items-center gap-1.5">
          <span className="mr-1 text-xs text-neutral-500 dark:text-neutral-400">
            Color:
          </span>
          {COMMENT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleColorChange(color)}
              className={`h-5 w-5 rounded-full transition-transform hover:scale-110 ${
                COLOR_BUTTON_CLASSES[color]
              } ${
                rootComment.color === color
                  ? "ring-2 ring-neutral-900 ring-offset-1 dark:ring-white"
                  : ""
              }`}
              title={color.charAt(0).toUpperCase() + color.slice(1)}
            />
          ))}
        </div>
      )}

      {/* Reply thread — visible only when the root is focused. */}
      {!isReplySelected && replies.length > 0 && (
        <div className="mb-3 space-y-1.5 border-t border-neutral-200 pt-2 dark:border-neutral-700">
          {replies.map((reply) => (
            <button
              key={reply.id}
              type="button"
              onClick={() => selectComment(reply.id)}
              className="block w-full rounded bg-neutral-50 p-2 text-left text-xs hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800"
            >
              {reply.author && (
                <CommentAuthorByline
                  author={reply.author}
                  authorColor={reply.authorColor}
                />
              )}
              <p className="whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                {reply.content || (
                  <span className="italic text-neutral-400">(empty)</span>
                )}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Reply composer — visible when root is focused and create is allowed. */}
      {!isReplySelected && adapter.canCreate && (
        <form
          onSubmit={handleReplySubmit}
          className="mb-2 border-t border-neutral-200 pt-2 dark:border-neutral-700"
        >
          <textarea
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            placeholder="Reply…"
            rows={2}
            className="mb-1.5 w-full resize-none rounded border border-neutral-200 bg-neutral-50 p-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={replyDraft.trim().length === 0}
              className="rounded px-2 py-0.5 text-xs text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              Reply
            </button>
          </div>
        </form>
      )}

      {/* Actions */}
      {(adapter.canResolve || adapter.canDelete) && (
        <div className="flex items-center justify-between border-t border-neutral-200 pt-2 dark:border-neutral-700">
          {!isReplySelected && adapter.canResolve ? (
            <button
              type="button"
              onClick={handleResolve}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
            >
              <Check size={14} />
              Resolve
            </button>
          ) : (
            <span />
          )}
          {adapter.canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CommentAuthorByline({
  author,
  authorColor,
}: {
  author: string;
  authorColor?: string;
}) {
  return (
    <div className="mb-1 flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
      {authorColor && (
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: authorColor }}
        />
      )}
      <span>{author}</span>
    </div>
  );
}
