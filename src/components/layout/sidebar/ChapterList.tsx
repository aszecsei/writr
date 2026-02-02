"use client";

import {
  CheckCircle2,
  Circle,
  Download,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from "@/components/ui/ContextMenu";
import { createChapter, deleteChapter, updateChapter } from "@/db/operations";
import { useChaptersByProject } from "@/hooks/useChapter";
import { useUiStore } from "@/store/uiStore";

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

  // Context menu state
  const [menuChapterId, setMenuChapterId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  // Inline rename state
  const [renamingChapterId, setRenamingChapterId] = useState<string | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

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
    const href = `/projects/${projectId}/chapters/${chapterId}`;
    await deleteChapter(chapterId);
    if (pathname === href) {
      router.push(`/projects/${projectId}`);
    }
  }

  async function handleAddChapter() {
    await createChapter({ projectId, title: "Untitled Chapter" });
  }

  return (
    <div className="space-y-1">
      {chapters?.map((chapter) => {
        const href = `/projects/${projectId}/chapters/${chapter.id}`;
        const isActive = pathname === href;
        const isRenaming = renamingChapterId === chapter.id;

        if (isRenaming) {
          return (
            <div
              key={chapter.id}
              className="flex items-center rounded-md bg-zinc-100 px-3 py-1.5 dark:bg-zinc-800"
            >
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameCommit}
                onKeyDown={handleRenameKeyDown}
                className="w-full bg-transparent text-sm text-zinc-900 outline-none dark:text-zinc-100"
              />
            </div>
          );
        }

        return (
          <Link
            key={chapter.id}
            href={href}
            onContextMenu={(e) => handleContextMenu(e, chapter.id)}
            className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
              isActive
                ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            <span className="truncate">{chapter.title}</span>
            <span className="ml-2 shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
              {chapter.wordCount.toLocaleString()}
            </span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={handleAddChapter}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
      >
        <Plus size={14} />
        Add Chapter
      </button>

      {/* Context Menu */}
      {menuChapterId && (
        <ContextMenu position={menuPos} onClose={closeMenu}>
          <ContextMenuItem
            icon={Pencil}
            onClick={() => {
              const ch = chapters?.find((c) => c.id === menuChapterId);
              if (ch) handleRenameStart(ch.id, ch.title);
            }}
          >
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            icon={Download}
            onClick={() => {
              closeMenu();
              openModal("export", {
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
            const chapter = chapters?.find((c) => c.id === menuChapterId);
            const isCurrent = chapter?.status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                  isCurrent
                    ? "font-medium text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-700 dark:text-zinc-300"
                } hover:bg-zinc-100 dark:hover:bg-zinc-800`}
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
    </div>
  );
}
