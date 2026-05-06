"use client";

import type { Editor } from "@tiptap/react";
import { Check, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const clearSelection = useCommentStore((s) => s.clearSelection);
  const [position, setPosition] = useState<{ top: number } | null>(null);
  const [content, setContent] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedComment = comments.find((c) => c.id === selectedId);

  // Update local content when selection changes
  useEffect(() => {
    if (selectedComment) {
      setContent(selectedComment.content);
    } else {
      setContent("");
    }
  }, [selectedComment]);

  // Calculate popover position (content-relative so it scrolls with content)
  useEffect(() => {
    if (!editor || editor.isDestroyed || !selectedComment) {
      setPosition(null);
      return;
    }

    const positionMap = getCommentPositions(editor.view.state);
    const top = calculateCommentTop(editor.view, selectedComment, positionMap);
    setPosition(top !== null ? { top: top - 10 } : null);
  }, [editor, selectedComment]);

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
    if (!selectedId || !adapter.canResolve) return;
    await adapter.resolve(selectedId);
    clearSelection();
  }, [adapter, selectedId, clearSelection]);

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

  if (!selectedComment || !position) {
    return null;
  }

  return (
    <div
      ref={popoverRef}
      className={`absolute z-50 w-64 rounded-lg border border-l-2 bg-white p-3 shadow-lg dark:bg-neutral-800 ${
        CARD_BORDER_COLOR[selectedComment.color]
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
          Comment
        </span>
        <button
          type="button"
          onClick={clearSelection}
          className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
        >
          <X size={14} />
        </button>
      </div>

      {/* Author byline (only when stamped — collab sessions) */}
      {selectedComment.author && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          {selectedComment.authorColor && (
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: selectedComment.authorColor }}
            />
          )}
          <span>{selectedComment.author}</span>
        </div>
      )}

      {/* Content textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleContentBlur}
        readOnly={!adapter.canEdit}
        placeholder={adapter.canEdit ? "Add a comment..." : ""}
        className="mb-3 h-20 w-full resize-none rounded border border-neutral-200 bg-neutral-50 p-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500"
      />

      {/* Color picker */}
      {adapter.canEdit && (
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
                selectedComment.color === color
                  ? "ring-2 ring-neutral-900 ring-offset-1 dark:ring-white"
                  : ""
              }`}
              title={color.charAt(0).toUpperCase() + color.slice(1)}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      {(adapter.canResolve || adapter.canDelete) && (
        <div className="flex items-center justify-between border-t border-neutral-200 pt-2 dark:border-neutral-700">
          {adapter.canResolve ? (
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
