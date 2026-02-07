"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import Link from "next/link";
import { DragHandle } from "@/components/bible/DragHandle";
import { formatReadingTimeCompact } from "@/lib/reading-time";

interface SortableChapterItemProps {
  chapter: {
    id: string;
    title: string;
    wordCount: number;
  };
  index: number;
  projectId: string;
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameKeyDown: (e: React.KeyboardEvent) => void;
  onContextMenu: (e: React.MouseEvent, chapterId: string) => void;
}

export function SortableChapterItem({
  chapter,
  index,
  projectId,
  isActive,
  isRenaming,
  renameValue,
  renameInputRef,
  onRenameChange,
  onRenameCommit,
  onRenameKeyDown,
  onContextMenu,
}: SortableChapterItemProps) {
  const { ref, handleRef, isDragSource } = useSortable({
    id: chapter.id,
    index,
  });

  const href = `/projects/${projectId}/chapters/${chapter.id}`;

  if (isRenaming) {
    return (
      <div
        ref={ref}
        className="flex items-center rounded-md bg-neutral-100 px-3 py-1.5 dark:bg-neutral-800"
      >
        <input
          ref={renameInputRef}
          type="text"
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onBlur={onRenameCommit}
          onKeyDown={onRenameKeyDown}
          className="w-full bg-transparent text-sm text-neutral-900 outline-none dark:text-neutral-100"
        />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`flex items-center rounded-md transition-colors ${
        isDragSource
          ? "opacity-50 ring-2 ring-neutral-300 dark:ring-neutral-600"
          : ""
      } ${
        isActive
          ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
          : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
      }`}
    >
      <DragHandle ref={handleRef} />
      <Link
        href={href}
        onContextMenu={(e) => onContextMenu(e, chapter.id)}
        className="flex flex-1 items-center justify-between py-density-item pr-3 text-sm"
      >
        <span className="truncate">{chapter.title}</span>
        <span className="ml-2 shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
          {chapter.wordCount.toLocaleString()} ·{" "}
          {formatReadingTimeCompact(chapter.wordCount)}
        </span>
      </Link>
    </div>
  );
}
