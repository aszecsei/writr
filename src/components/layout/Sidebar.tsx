"use client";

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  FileText,
  FolderOpen,
  GitFork,
  Globe,
  LayoutGrid,
  MapPin,
  Pen,
  Pencil,
  Plus,
  Settings,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createChapter, deleteChapter, updateChapter } from "@/db/operations";
import { useChaptersByProject } from "@/hooks/useChapter";
import { type SidebarPanel, useUiStore } from "@/store/uiStore";

const panels: { id: SidebarPanel; label: string; icon: LucideIcon }[] = [
  { id: "chapters", label: "Chapters", icon: FileText },
  { id: "bible", label: "Bible", icon: BookOpen },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const pathname = usePathname();
  const sidebarPanel = useUiStore((s) => s.sidebarPanel);
  const setSidebarPanel = useUiStore((s) => s.setSidebarPanel);

  return (
    <aside className="flex h-full flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <nav className="flex border-b border-zinc-200 dark:border-zinc-800">
        {panels.map((panel) => {
          const Icon = panel.icon;
          return (
            <button
              key={panel.id}
              type="button"
              onClick={() => setSidebarPanel(panel.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
                sidebarPanel === panel.id
                  ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              <Icon size={14} />
              {panel.label}
            </button>
          );
        })}
      </nav>
      <div className="flex-1 overflow-y-auto p-3">
        {sidebarPanel === "chapters" && (
          <ChapterList projectId={projectId} pathname={pathname} />
        )}
        {sidebarPanel === "bible" && (
          <BibleNav projectId={projectId} pathname={pathname} />
        )}
        {sidebarPanel === "settings" && (
          <SettingsNav projectId={projectId} pathname={pathname} />
        )}
      </div>
    </aside>
  );
}

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "revised", label: "Revised" },
  { value: "final", label: "Final" },
] as const;

function ChapterList({
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
  const menuRef = useRef<HTMLDivElement>(null);

  // Inline rename state
  const [renamingChapterId, setRenamingChapterId] = useState<string | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const closeMenu = useCallback(() => setMenuChapterId(null), []);

  // Close menu on click outside or Escape
  useEffect(() => {
    if (!menuChapterId) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuChapterId, closeMenu]);

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
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            onClick={() => {
              const ch = chapters?.find((c) => c.id === menuChapterId);
              if (ch) handleRenameStart(ch.id, ch.title);
            }}
          >
            <Pencil size={14} />
            Rename
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            onClick={() => {
              closeMenu();
              openModal("export", {
                projectId,
                chapterId: menuChapterId,
                scope: "chapter",
              });
            }}
          >
            <Download size={14} />
            Export
          </button>
          <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
          <div className="px-3 py-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
            Status
          </div>
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
          <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
            onClick={() => handleDelete(menuChapterId)}
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

const bibleLinks: { label: string; path: string; icon: LucideIcon }[] = [
  { label: "Characters", path: "bible/characters", icon: Users },
  { label: "Locations", path: "bible/locations", icon: MapPin },
  { label: "Timeline", path: "bible/timeline", icon: Clock },
  { label: "Family Tree", path: "bible/family-tree", icon: GitFork },
  { label: "Style Guide", path: "bible/style-guide", icon: Pen },
  { label: "Worldbuilding", path: "bible/worldbuilding", icon: Globe },
];

function BibleNav({
  projectId,
  pathname,
}: {
  projectId: string;
  pathname: string;
}) {
  return (
    <div className="space-y-1">
      <Link
        href={`/projects/${projectId}/bible`}
        className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          pathname === `/projects/${projectId}/bible`
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
        }`}
      >
        <LayoutGrid size={14} />
        Overview
      </Link>
      {bibleLinks.map((link) => {
        const href = `/projects/${projectId}/${link.path}`;
        const isActive = pathname.startsWith(href);
        const Icon = link.icon;
        return (
          <Link
            key={link.path}
            href={href}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive
                ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            <Icon size={14} />
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}

function SettingsNav({
  projectId,
  pathname,
}: {
  projectId: string;
  pathname: string;
}) {
  const openModal = useUiStore((s) => s.openModal);

  return (
    <div className="space-y-1">
      <Link
        href={`/projects/${projectId}`}
        className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
          pathname === `/projects/${projectId}`
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
        }`}
      >
        <FolderOpen size={14} />
        Project Overview
      </Link>
      <button
        type="button"
        onClick={() => openModal("app-settings")}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
      >
        <Settings size={14} />
        App Settings
      </button>
    </div>
  );
}
