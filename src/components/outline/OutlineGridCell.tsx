"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type {
  OutlineCardColor,
  OutlineGridCell as OutlineGridCellType,
} from "@/db/schemas";

const COLOR_CLASSES: Record<OutlineCardColor, string> = {
  white: "bg-white dark:bg-zinc-900",
  yellow: "bg-amber-50 dark:bg-amber-950/50",
  pink: "bg-pink-50 dark:bg-pink-950/50",
  blue: "bg-sky-50 dark:bg-sky-950/50",
  green: "bg-emerald-50 dark:bg-emerald-950/50",
  orange: "bg-orange-50 dark:bg-orange-950/50",
  purple: "bg-violet-50 dark:bg-violet-950/50",
};

interface OutlineGridCellProps {
  cell: OutlineGridCellType | undefined;
  onSave: (content: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function OutlineGridCell({
  cell,
  onSave,
  onContextMenu,
}: OutlineGridCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(cell?.content ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const content = cell?.content ?? "";
  const color = cell?.color ?? "white";

  // Sync editValue when cell content changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditValue(content);
    }
  }, [content, isEditing]);

  const startEditing = useCallback(() => {
    setEditValue(content);
    setIsEditing(true);
  }, [content]);

  const saveAndClose = useCallback(() => {
    setIsEditing(false);
    if (editValue !== content) {
      onSave(editValue);
    }
  }, [editValue, content, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditValue(content);
        setIsEditing(false);
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        saveAndClose();
      }
    },
    [content, saveAndClose],
  );

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [isEditing]);

  return (
    <td
      className={`border border-zinc-200 p-0 dark:border-zinc-700 ${COLOR_CLASSES[color]}`}
      onContextMenu={onContextMenu}
    >
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveAndClose}
          onKeyDown={handleKeyDown}
          className="h-full min-h-[80px] w-full resize-none bg-transparent p-2 text-sm text-zinc-800 outline-none dark:text-zinc-200"
          placeholder="Enter notes..."
        />
      ) : (
        <button
          type="button"
          className="block min-h-[80px] w-full cursor-text p-2 text-left"
          onClick={startEditing}
        >
          {content ? (
            <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <span className="text-sm text-zinc-400 dark:text-zinc-500">
              Click to edit...
            </span>
          )}
        </button>
      )}
    </td>
  );
}
