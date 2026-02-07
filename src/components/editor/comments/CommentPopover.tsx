"use client";

import type { Editor } from "@tiptap/react";
import { Check, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { deleteComment, resolveComment, updateComment } from "@/db/operations";
import type { Comment, CommentColor } from "@/db/schemas";
import { useCommentStore } from "@/store/commentStore";
import { getCommentPositions } from "../extensions/Comments";

interface CommentPopoverProps {
  editor: Editor | null;
  comments: Comment[];
}

const COLORS: CommentColor[] = ["yellow", "blue", "green", "red", "purple"];

const COLOR_BUTTON_CLASSES: Record<CommentColor, string> = {
  yellow: "bg-yellow-400 hover:bg-yellow-500",
  blue: "bg-blue-400 hover:bg-blue-500",
  green: "bg-green-400 hover:bg-green-500",
  red: "bg-red-400 hover:bg-red-500",
  purple: "bg-purple-400 hover:bg-purple-500",
};

const CARD_BORDER_COLOR: Record<CommentColor, string> = {
  yellow: "border-l-yellow-400 dark:border-l-yellow-500",
  blue: "border-l-blue-400 dark:border-l-blue-500",
  green: "border-l-green-400 dark:border-l-green-500",
  red: "border-l-red-400 dark:border-l-red-500",
  purple: "border-l-purple-400 dark:border-l-purple-500",
};

export function CommentPopover({ editor, comments }: CommentPopoverProps) {
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

    const view = editor.view;
    const docSize = view.state.doc.content.size;
    const positionMap = getCommentPositions(view.state);
    const mapped = positionMap.get(selectedComment.id);
    const pos = Math.max(
      1,
      Math.min(mapped?.from ?? selectedComment.fromOffset, docSize),
    );
    const scrollContainer = view.dom.closest(
      ".overflow-y-auto",
    ) as HTMLElement | null;

    if (!scrollContainer) return;

    try {
      const coords = view.coordsAtPos(pos);
      const containerRect = scrollContainer.getBoundingClientRect();
      // Content-relative position: auto-scrolls with content
      const top = coords.top - containerRect.top + scrollContainer.scrollTop;
      setPosition({ top: top - 10 });
    } catch {
      setPosition(null);
    }
  }, [editor, selectedComment]);

  // Focus textarea when popover opens
  useEffect(() => {
    if (position && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [position]);

  // Close on click outside or Escape
  useEffect(() => {
    if (!selectedId) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        if (selectedComment && content !== selectedComment.content) {
          updateComment(selectedId, { content });
        }
        clearSelection();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedComment && content !== selectedComment.content) {
          updateComment(selectedId, { content });
        }
        clearSelection();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedId, selectedComment, content, clearSelection]);

  const handleColorChange = useCallback(
    async (color: CommentColor) => {
      if (!selectedId) return;
      await updateComment(selectedId, { color });
    },
    [selectedId],
  );

  const handleResolve = useCallback(async () => {
    if (!selectedId) return;
    await resolveComment(selectedId);
    clearSelection();
  }, [selectedId, clearSelection]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;
    await deleteComment(selectedId);
    clearSelection();
  }, [selectedId, clearSelection]);

  const handleContentBlur = useCallback(async () => {
    if (!selectedId || !selectedComment) return;
    if (content !== selectedComment.content) {
      await updateComment(selectedId, { content });
    }
  }, [selectedId, selectedComment, content]);

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

      {/* Content textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleContentBlur}
        placeholder="Add a comment..."
        className="mb-3 h-20 w-full resize-none rounded border border-neutral-200 bg-neutral-50 p-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500"
      />

      {/* Color picker */}
      <div className="mb-3 flex items-center gap-1.5">
        <span className="mr-1 text-xs text-neutral-500 dark:text-neutral-400">
          Color:
        </span>
        {COLORS.map((color) => (
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

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-neutral-200 pt-2 dark:border-neutral-700">
        <button
          type="button"
          onClick={handleResolve}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
        >
          <Check size={14} />
          Resolve
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </div>
  );
}
