"use client";

import {
  AlertCircle,
  Check,
  Download,
  Loader2,
  Menu,
  Sparkles,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { useAppSettings } from "@/hooks/useAppSettings";
import { formatReadingTime } from "@/lib/reading-time";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { useSprintStore } from "@/store/sprintStore";
import { useUiStore } from "@/store/uiStore";

export function TopBar() {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const toggleAiPanel = useUiStore((s) => s.toggleAiPanel);
  const aiPanelOpen = useUiStore((s) => s.aiPanelOpen);
  const openModal = useUiStore((s) => s.openModal);
  const projectTitle = useProjectStore((s) => s.activeProjectTitle);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const wordCount = useEditorStore((s) => s.wordCount);
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const openSprintConfig = useSprintStore((s) => s.openConfigModal);
  const activeSprintId = useSprintStore((s) => s.activeSprintId);
  const settings = useAppSettings();

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} />
        </button>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
        >
          writr
        </Link>
        {projectTitle && (
          <>
            <span className="text-zinc-300 dark:text-zinc-600">/</span>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {projectTitle}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-4">
        {activeDocumentId && (
          <>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {wordCount.toLocaleString()} words ·{" "}
              {formatReadingTime(wordCount, settings?.readingSpeedWpm)}
            </span>
            <SaveStatusIndicator status={saveStatus} />
          </>
        )}
        {activeProjectId && (
          <>
            <button
              type="button"
              onClick={() =>
                openModal("export", {
                  projectId: activeProjectId,
                  scope: "book",
                })
              }
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all duration-150 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <Download size={14} />
              Export
            </button>
            <button
              type="button"
              onClick={openSprintConfig}
              disabled={!!activeSprintId}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                activeSprintId
                  ? "cursor-not-allowed opacity-50"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <Timer size={14} />
              Sprint
            </button>
          </>
        )}
        <button
          type="button"
          onClick={toggleAiPanel}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400 ${
            aiPanelOpen
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          <Sparkles size={14} />
          AI
        </button>
      </div>
    </header>
  );
}

function SaveStatusIndicator({
  status,
}: {
  status: "idle" | "saving" | "saved" | "error";
}) {
  if (status === "idle") return null;

  return (
    <span
      className={`flex items-center gap-1 text-xs ${
        status === "error" ? "text-red-500" : "text-zinc-400 dark:text-zinc-500"
      }`}
    >
      {status === "saving" && <Loader2 size={12} className="animate-spin" />}
      {status === "saved" && <Check size={12} />}
      {status === "error" && <AlertCircle size={12} />}
      {status === "saving" && "Saving..."}
      {status === "saved" && "Saved"}
      {status === "error" && "Save failed"}
    </span>
  );
}
