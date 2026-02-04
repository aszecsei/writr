"use client";

import ReactMarkdown from "react-markdown";
import type {
  OutlineCardColor,
  OutlineGridCell as OutlineGridCellType,
} from "@/db/schemas";
import { useHighlightFade } from "@/hooks/useHighlightFade";
import { useInlineEdit } from "@/hooks/useInlineEdit";

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
  isHighlighted?: boolean;
  onSave: (content: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function OutlineGridCell({
  cell,
  isHighlighted,
  onSave,
  onContextMenu,
}: OutlineGridCellProps) {
  const content = cell?.content ?? "";
  const color = cell?.color ?? "white";

  const { elementRef, showHighlight } = useHighlightFade(isHighlighted);

  const {
    isEditing,
    editValue,
    setEditValue,
    inputRef,
    startEditing,
    saveAndClose,
    handleKeyDown,
  } = useInlineEdit({
    initialValue: content,
    onSave,
    saveOnEnter: false,
    saveOnCtrlEnter: true,
  });

  const highlightClasses = showHighlight
    ? "ring-2 ring-yellow-400 border-yellow-400 dark:ring-yellow-500 dark:border-yellow-500"
    : "";

  return (
    <td
      ref={elementRef as React.RefObject<HTMLTableCellElement>}
      className={`border border-zinc-200 p-0 transition-all duration-500 dark:border-zinc-700 ${COLOR_CLASSES[color]} ${highlightClasses}`}
      onContextMenu={onContextMenu}
    >
      {isEditing ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
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
