"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import { ChevronDown, ChevronRight, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { DragHandle } from "@/components/bible/DragHandle";
import type { ChapterId, ProjectId } from "@/db/schemas";
import type { FlatRow } from "@/lib/binder/tree";
import { formatReadingTimeCompact } from "@/lib/reading-time";

/** Pixels of indentation per nesting level (also the drag depth threshold). */
export const INDENT_PX = 24;

/** Shared state and callbacks threaded to every row of the binder tree. */
export interface BinderItemShared {
  projectId: ProjectId;
  pathname: string;
  subtreeTotals: Map<ChapterId, number>;
  /** Subtree hole counts keyed by chapter id (see `subtreeHoleCounts`). */
  subtreeHoles: Map<ChapterId, number>;
  collapsed: Record<string, boolean>;
  renamingChapterId: ChapterId | null;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onToggleCollapsed: (id: ChapterId) => void;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameKeyDown: (e: React.KeyboardEvent) => void;
  onContextMenu: (e: React.MouseEvent, chapterId: ChapterId) => void;
  onSeparatorOpen: (id: ChapterId) => void;
  /** Scene count per chapter (Model D). A chapter with >1 scene shows a scene
   *  chevron and a "N scenes" subtitle. */
  sceneCounts: Map<ChapterId, number>;
  /** Which chapters are expanded to show their scene rows. */
  openChapters: Record<string, boolean>;
  onToggleChapterOpen: (id: ChapterId) => void;
  /** Chapter currently highlighted as the target of a scene drag, if any. */
  sceneDropTargetId: ChapterId | null;
}

/** A single flat row of the binder (one entry of the flattened visible tree). */
export function BinderItem({
  row,
  index,
  shared,
}: {
  row: FlatRow;
  index: number;
  shared: BinderItemShared;
}) {
  const { chapter, depth, parentId, hasChildren } = row;
  const { ref, handleRef, isDragSource } = useSortable({
    id: chapter.id,
    index,
    // A chapter row is both a chapter reorder target and a scene drop target
    // (drag a scene onto it to move the scene into this chapter).
    type: "chapter",
    accept: ["chapter", "scene"],
    data: { depth, parentId },
    transition: { idle: true },
  });
  const indent = depth * INDENT_PX;

  if (chapter.kind === "separator") {
    const isSeparatorCollapsed = shared.collapsed[chapter.id] === true;
    return (
      <div
        ref={ref}
        aria-hidden={isDragSource}
        className={`flex items-center gap-1 ${isDragSource ? "opacity-40" : ""}`}
        style={{ paddingLeft: indent }}
      >
        <DragHandle ref={handleRef} />
        <button
          type="button"
          aria-label={isSeparatorCollapsed ? "Expand" : "Collapse"}
          onClick={() => shared.onToggleCollapsed(chapter.id)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          {isSeparatorCollapsed ? (
            <ChevronRight size={13} />
          ) : (
            <ChevronDown size={13} />
          )}
        </button>
        <button
          type="button"
          onClick={() => shared.onSeparatorOpen(chapter.id)}
          onContextMenu={(e) => shared.onContextMenu(e, chapter.id)}
          className="truncate text-[11px] font-medium uppercase tracking-wide text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
        >
          {chapter.title}
        </button>
        <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
      </div>
    );
  }

  const isCollapsed = shared.collapsed[chapter.id] === true;
  const isRenaming = shared.renamingChapterId === chapter.id;
  const href = `/projects/${shared.projectId}/chapters/${chapter.id}`;
  const isActive = shared.pathname === href;
  const isSceneDropTarget = shared.sceneDropTargetId === chapter.id;

  const own = chapter.wordCount;
  const total = shared.subtreeTotals.get(chapter.id) ?? own;
  const primary = hasChildren ? total : own;
  const holeCount = shared.subtreeHoles.get(chapter.id) ?? 0;
  const sceneCount = shared.sceneCounts.get(chapter.id) ?? 0;
  // A chapter's scenes are shown only when it has more than one (the core scene
  // alone reads as a plain chapter). Legacy nested children take precedence.
  const showSceneChevron = !hasChildren && sceneCount > 1;
  const isSceneOpen = shared.openChapters[chapter.id] === true;

  if (isRenaming) {
    return (
      <div
        className="flex items-center rounded-md bg-neutral-100 py-1.5 pr-3 dark:bg-neutral-800"
        style={{ paddingLeft: indent + 24 }}
      >
        <input
          ref={shared.renameInputRef}
          type="text"
          value={shared.renameValue}
          onChange={(e) => shared.onRenameChange(e.target.value)}
          onBlur={shared.onRenameCommit}
          onKeyDown={shared.onRenameKeyDown}
          className="w-full bg-transparent text-sm text-neutral-900 outline-none dark:text-neutral-100"
        />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      aria-hidden={isDragSource}
      className={`flex items-center rounded-md transition-colors ${
        isDragSource ? "opacity-40" : ""
      } ${
        isSceneDropTarget
          ? "ring-2 ring-inset ring-primary-400 dark:ring-primary-500"
          : ""
      } ${
        isActive
          ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
          : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
      }`}
      style={{ paddingLeft: indent }}
    >
      <DragHandle ref={handleRef} />
      {hasChildren ? (
        <button
          type="button"
          aria-label={isCollapsed ? "Expand" : "Collapse"}
          onClick={() => shared.onToggleCollapsed(chapter.id)}
          className="flex h-6 w-5 shrink-0 items-center justify-center rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
      ) : showSceneChevron ? (
        <button
          type="button"
          aria-label={isSceneOpen ? "Hide scenes" : "Show scenes"}
          onClick={() => shared.onToggleChapterOpen(chapter.id)}
          className="flex h-6 w-5 shrink-0 items-center justify-center rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          {isSceneOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      ) : (
        <span className="h-6 w-5 shrink-0" />
      )}
      <Link
        href={href}
        onContextMenu={(e) => shared.onContextMenu(e, chapter.id)}
        className="flex flex-1 items-center justify-between gap-2 overflow-hidden rounded-r-md py-density-item pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
      >
        <span className="truncate">{chapter.title}</span>
        <span className="ml-2 flex shrink-0 items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500">
          {holeCount > 0 && (
            <span
              role="img"
              className="flex items-center gap-0.5 text-amber-500 dark:text-amber-400"
              title={`${holeCount} ${holeCount === 1 ? "hole" : "holes"}`}
              aria-label={`${holeCount} ${holeCount === 1 ? "hole" : "holes"}`}
            >
              <TriangleAlert size={12} />
              {holeCount.toLocaleString()}
            </span>
          )}
          {sceneCount > 1 && (
            <span className="text-neutral-300 dark:text-neutral-600">
              {sceneCount} scenes ·
            </span>
          )}
          {hasChildren && own > 0 && (
            <span className="text-neutral-300 dark:text-neutral-600">
              ({own.toLocaleString()})
            </span>
          )}
          {primary.toLocaleString()} · {formatReadingTimeCompact(primary)}
        </span>
      </Link>
    </div>
  );
}

/** A lightweight preview rendered in the DragOverlay while dragging. */
export function BinderItemOverlay({ title }: { title: string }) {
  return (
    <div className="flex items-center rounded-md bg-neutral-100 px-2 py-density-item text-sm text-neutral-900 shadow-lg ring-1 ring-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:ring-neutral-600">
      <span className="truncate">{title}</span>
    </div>
  );
}
