"use client";

import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import {
  CheckCircle2,
  Circle,
  Columns3,
  Download,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from "@/components/ui/ContextMenu";
import {
  createChapter,
  hasLinkedRow,
  syncDeleteChapter,
  syncReorderChapters,
  updateChapter,
} from "@/db/operations";
import { useChaptersByProject } from "@/hooks/data/useChapter";
import { getTerm } from "@/lib/terminology";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";
import { SortableChapterItem } from "./SortableChapterItem";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "revised", label: "Revised" },
  { value: "final", label: "Final" },
] as const;

export function ChapterList({
  projectId,
  pathname,
}: {
  projectId: string;
  pathname: string;
}) {
  const chapters = useChaptersByProject(projectId);
  const router = useRouter();
  const openModal = useUiStore((s) => s.openModal);
  const activeProjectMode = useProjectStore((s) => s.activeProjectMode);

  // Optimistic local state for drag reordering
  const [localChapters, setLocalChapters] = useState(chapters ?? []);
  const previousChapters = useRef(localChapters);
  const isDragging = useRef(false);

  // Sync Dexie live query -> local state (suppressed during drag)
  useEffect(() => {
    if (chapters && !isDragging.current) {
      setLocalChapters(chapters);
    }
  }, [chapters]);

  // Context menu state
  const [menuChapterId, setMenuChapterId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  // Inline rename state
  const [renamingChapterId, setRenamingChapterId] = useState<string | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    chapterId: string;
    chapterTitle: string;
    hasLinkedRow: boolean;
  } | null>(null);

  const closeMenu = useCallback(() => setMenuChapterId(null), []);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingChapterId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingChapterId]);

  function handleContextMenu(e: React.MouseEvent, chapterId: string) {
    e.preventDefault();
    setMenuChapterId(chapterId);
    setMenuPos({ x: e.clientX, y: e.clientY });
  }

  function handleRenameStart(chapterId: string, currentTitle: string) {
    setRenamingChapterId(chapterId);
    setRenameValue(currentTitle);
    closeMenu();
  }

  async function handleRenameCommit() {
    if (renamingChapterId && renameValue.trim()) {
      await updateChapter(renamingChapterId, { title: renameValue.trim() });
    }
    setRenamingChapterId(null);
  }

  function handleRenameCancel() {
    setRenamingChapterId(null);
  }

  function handleRenameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleRenameCommit();
    } else if (e.key === "Escape") {
      handleRenameCancel();
    }
  }

  async function handleSetStatus(
    chapterId: string,
    status: "draft" | "revised" | "final",
  ) {
    await updateChapter(chapterId, { status });
    closeMenu();
  }

  async function handleDelete(chapterId: string) {
    closeMenu();
    const chapter = localChapters.find((c) => c.id === chapterId);
    if (!chapter) return;

    // Check if chapter has a linked outline row
    if (await hasLinkedRow(chapterId)) {
      setDeleteConfirm({
        chapterId,
        chapterTitle: chapter.title,
        hasLinkedRow: true,
      });
      return;
    }

    const href = `/projects/${projectId}/chapters/${chapterId}`;
    await syncDeleteChapter(chapterId, false);
    if (pathname === href) {
      router.push(`/projects/${projectId}`);
    }
  }

  async function handleConfirmDeleteChapter() {
    if (!deleteConfirm) return;
    const href = `/projects/${projectId}/chapters/${deleteConfirm.chapterId}`;
    await syncDeleteChapter(deleteConfirm.chapterId, false);
    setDeleteConfirm(null);
    if (pathname === href) {
      router.push(`/projects/${projectId}`);
    }
  }

  async function handleConfirmDeleteChapterAndRow() {
    if (!deleteConfirm) return;
    const href = `/projects/${projectId}/chapters/${deleteConfirm.chapterId}`;
    await syncDeleteChapter(deleteConfirm.chapterId, true);
    setDeleteConfirm(null);
    if (pathname === href) {
      router.push(`/projects/${projectId}`);
    }
  }

  async function handleAddChapter() {
    await createChapter({
      projectId,
      title: getTerm(activeProjectMode, "untitledChapter"),
    });
  }

  const overviewHref = `/projects/${projectId}`;
  const isOverviewActive = pathname === overviewHref;

  return (
    <div className="space-y-1">
      <Link
        href={overviewHref}
        className={`flex items-center gap-2 rounded-md px-3 py-density-item text-sm transition-colors ${
          isOverviewActive
            ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
        }`}
      >
        <FolderOpen size={14} />
        Project Overview
      </Link>

      <Link
        href={`/projects/${projectId}/outline`}
        className={`flex items-center gap-2 rounded-md px-3 py-density-item text-sm transition-colors ${
          pathname.startsWith(`/projects/${projectId}/outline`)
            ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
        }`}
      >
        <Columns3 size={14} />
        Outline
      </Link>

      <DragDropProvider
        onDragStart={() => {
          isDragging.current = true;
          previousChapters.current = localChapters;
        }}
        onDragOver={(event) => {
          setLocalChapters((items) => move(items, event));
        }}
        onDragEnd={async (event) => {
          isDragging.current = false;
          if (event.canceled) {
            setLocalChapters(previousChapters.current);
            return;
          }
          const orderedIds = localChapters.map((c) => c.id);
          await syncReorderChapters(orderedIds);
        }}
      >
        <div className="space-y-1">
          {localChapters.map((chapter, index) => {
            const href = `/projects/${projectId}/chapters/${chapter.id}`;
            const isActive = pathname === href;
            const isRenaming = renamingChapterId === chapter.id;

            return (
              <SortableChapterItem
                key={chapter.id}
                chapter={chapter}
                index={index}
                projectId={projectId}
                isActive={isActive}
                isRenaming={isRenaming}
                renameValue={renameValue}
                renameInputRef={renameInputRef}
                onRenameChange={setRenameValue}
                onRenameCommit={handleRenameCommit}
                onRenameKeyDown={handleRenameKeyDown}
                onContextMenu={handleContextMenu}
              />
            );
          })}
        </div>
      </DragDropProvider>

      <button
        type="button"
        onClick={handleAddChapter}
        className="flex w-full items-center gap-2 rounded-md px-3 py-density-item text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-300"
      >
        <Plus size={14} />
        {getTerm(activeProjectMode, "addChapter")}
      </button>

      {/* Context Menu */}
      {menuChapterId && (
        <ContextMenu position={menuPos} onClose={closeMenu}>
          <ContextMenuItem
            icon={Pencil}
            onClick={() => {
              const ch = localChapters.find((c) => c.id === menuChapterId);
              if (ch) handleRenameStart(ch.id, ch.title);
            }}
          >
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            icon={Download}
            onClick={() => {
              closeMenu();
              openModal({
                id: "export",
                projectId,
                chapterId: menuChapterId,
                scope: "chapter",
              });
            }}
          >
            Export
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuLabel>Status</ContextMenuLabel>
          {STATUS_OPTIONS.map((opt) => {
            const chapter = localChapters.find((c) => c.id === menuChapterId);
            const isCurrent = chapter?.status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                  isCurrent
                    ? "font-medium text-neutral-900 dark:text-neutral-100"
                    : "text-neutral-700 dark:text-neutral-300"
                } hover:bg-neutral-100 dark:hover:bg-neutral-800`}
                onClick={() => handleSetStatus(menuChapterId, opt.value)}
              >
                {isCurrent ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                {opt.label}
              </button>
            );
          })}
          <ContextMenuSeparator />
          <ContextMenuItem
            icon={Trash2}
            variant="danger"
            onClick={() => handleDelete(menuChapterId)}
          >
            Delete
          </ContextMenuItem>
        </ContextMenu>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <ConfirmDialog
          title="Delete linked chapter?"
          message={
            <>
              The chapter <strong>"{deleteConfirm.chapterTitle}"</strong> is
              linked to an outline row. You can delete just the chapter or
              delete both the chapter and outline row.
            </>
          }
          variant="danger"
          confirmLabel="Delete chapter only"
          onConfirm={handleConfirmDeleteChapter}
          onCancel={() => setDeleteConfirm(null)}
          extraAction={{
            label: "Delete chapter and row",
            onClick: handleConfirmDeleteChapterAndRow,
          }}
        />
      )}
    </div>
  );
}
