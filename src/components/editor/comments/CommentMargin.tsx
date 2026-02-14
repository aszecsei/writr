"use client";

import type { Editor } from "@tiptap/react";
import { Check, MessageSquare, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { deleteComment, resolveComment, updateComment } from "@/db/operations";
import type { Comment, CommentColor } from "@/db/schemas";
import { useCommentStore } from "@/store/commentStore";
import { getCommentPositions } from "../extensions/Comments";
import {
  CARD_BORDER_COLOR,
  COLOR_BUTTON_CLASSES,
  COMMENT_COLORS,
} from "./colors";
import { calculateCommentTop } from "./position";

interface CommentMarginProps {
  editor: Editor | null;
  comments: Comment[];
  expanded: boolean;
}

interface CommentPosition {
  id: string;
  top: number;
  comment: Comment;
}

export function CommentMargin({
  editor,
  comments,
  expanded,
}: CommentMarginProps) {
  const [positions, setPositions] = useState<CommentPosition[]>([]);
  const selectComment = useCommentStore((s) => s.selectComment);
  const clearSelection = useCommentStore((s) => s.clearSelection);
  const selectedId = useCommentStore((s) => s.selectedId);

  const calculatePositions = useCallback(() => {
    if (!editor || editor.isDestroyed) {
      setPositions([]);
      return;
    }

    const view = editor.view;
    const newPositions: CommentPosition[] = [];
    const positionMap = getCommentPositions(view.state);

    for (const comment of comments) {
      if (comment.status === "resolved") continue;

      const top = calculateCommentTop(view, comment, positionMap);
      if (top !== null) {
        newPositions.push({ id: comment.id, top, comment });
      }
    }

    // Sort by top position and handle overlaps
    newPositions.sort((a, b) => a.top - b.top);
    const minGap = expanded ? 72 : 20;
    for (let i = 1; i < newPositions.length; i++) {
      const prev = newPositions[i - 1];
      const curr = newPositions[i];
      if (curr.top - prev.top < minGap) {
        curr.top = prev.top + minGap;
      }
    }

    setPositions(newPositions);
  }, [editor, comments, expanded]);

  useEffect(() => {
    calculatePositions();
  }, [calculatePositions]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const scrollContainer = editor.view.dom.closest(".overflow-y-auto");
    if (!scrollContainer) return;

    scrollContainer.addEventListener("scroll", calculatePositions);
    return () =>
      scrollContainer.removeEventListener("scroll", calculatePositions);
  }, [editor, calculatePositions]);

  useEffect(() => {
    if (!editor) return;

    editor.on("update", calculatePositions);
    return () => {
      editor.off("update", calculatePositions);
    };
  }, [editor, calculatePositions]);

  if (!editor || positions.length === 0) {
    return null;
  }

  if (expanded) {
    return (
      <div
        className="pointer-events-none absolute top-0"
        style={{
          zIndex: 10,
          height: "100%",
          left: "calc(50% + var(--editor-content-width) / 2 + 1rem)",
          width: "16rem",
        }}
      >
        {positions.map((pos) => (
          <ExpandedCard
            key={pos.id}
            commentPosition={pos}
            isSelected={selectedId === pos.id}
            onSelect={() => selectComment(pos.id)}
            onDeselect={clearSelection}
          />
        ))}
      </div>
    );
  }

  // Collapsed mode: small indicators
  return (
    <div
      className="pointer-events-none absolute top-0"
      style={{
        zIndex: 10,
        height: "100%",
        left: "calc(50% + var(--editor-content-width) / 2 + 0.5rem)",
        width: "2rem",
      }}
    >
      {positions.map((pos) => (
        <button
          key={pos.id}
          type="button"
          onClick={() => selectComment(pos.id)}
          className={`pointer-events-auto absolute flex items-center justify-center transition-transform hover:scale-110 h-4 w-5 rounded border-l-2 bg-neutral-100 dark:bg-neutral-800 ${CARD_BORDER_COLOR[pos.comment.color]} ${selectedId === pos.id ? "ring-2 ring-neutral-900 dark:ring-white" : ""}`}
          style={{ top: pos.top - 8 }}
          title="Comment"
        >
          <MessageSquare
            size={10}
            className="text-neutral-500 dark:text-neutral-400"
          />
        </button>
      ))}
    </div>
  );
}

/* ─── Expanded card for full-view mode ─── */

function ExpandedCard({
  commentPosition,
  isSelected,
  onSelect,
  onDeselect,
}: {
  commentPosition: CommentPosition;
  isSelected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
}) {
  const { comment, top } = commentPosition;
  const [editContent, setEditContent] = useState(comment.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Sync content when comment changes externally
  useEffect(() => {
    setEditContent(comment.content);
  }, [comment.content]);

  // Focus textarea when selected
  useEffect(() => {
    if (isSelected && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isSelected]);

  const handleSaveContent = useCallback(async () => {
    if (editContent !== comment.content) {
      await updateComment(comment.id, { content: editContent });
    }
  }, [comment.id, comment.content, editContent]);

  const handleColorChange = useCallback(
    async (color: CommentColor) => {
      await updateComment(comment.id, { color });
    },
    [comment.id],
  );

  const handleResolve = useCallback(async () => {
    await resolveComment(comment.id);
    onDeselect();
  }, [comment.id, onDeselect]);

  const handleDelete = useCallback(async () => {
    await deleteComment(comment.id);
    onDeselect();
  }, [comment.id, onDeselect]);

  const sharedClassName = `pointer-events-auto absolute w-full rounded border-l-2 bg-white text-left shadow-sm transition-shadow dark:bg-neutral-800 ${
    CARD_BORDER_COLOR[comment.color]
  }`;

  if (isSelected) {
    return (
      <div
        className={`${sharedClassName} border border-l-2 border-neutral-300 shadow-md dark:border-neutral-600`}
        style={{ top: top - 10, zIndex: 10 }}
      >
        <div className="p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Comment
            </span>
            <button
              type="button"
              onClick={() => {
                handleSaveContent();
                onDeselect();
              }}
              className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
            >
              <X size={12} />
            </button>
          </div>

          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onBlur={handleSaveContent}
            placeholder="Add a comment..."
            className="mb-2 h-16 w-full resize-none rounded border border-neutral-200 bg-neutral-50 p-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500"
          />

          {/* Color picker */}
          <div className="mb-2 flex items-center gap-1">
            {COMMENT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleColorChange(color)}
                className={`h-4 w-4 rounded-full transition-transform hover:scale-110 ${
                  COLOR_BUTTON_CLASSES[color]
                } ${
                  comment.color === color
                    ? "ring-2 ring-neutral-900 ring-offset-1 dark:ring-white"
                    : ""
                }`}
                title={color.charAt(0).toUpperCase() + color.slice(1)}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-neutral-200 pt-1.5 dark:border-neutral-700">
            <button
              type="button"
              onClick={handleResolve}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
            >
              <Check size={12} />
              Resolve
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`${sharedClassName} cursor-pointer border border-l-2 border-neutral-200 hover:shadow dark:border-neutral-700`}
      style={{ top: top - 10, zIndex: 1 }}
      onClick={onSelect}
    >
      <div className="px-2 py-1.5">
        {comment.content ? (
          <p className="line-clamp-2 text-xs text-neutral-700 dark:text-neutral-300">
            {comment.content}
          </p>
        ) : (
          <p className="text-xs italic text-neutral-400 dark:text-neutral-500">
            Empty comment
          </p>
        )}
      </div>
    </button>
  );
}
