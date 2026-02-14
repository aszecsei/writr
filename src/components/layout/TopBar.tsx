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
import { SearchBar } from "@/components/search";
import { useAppSettings } from "@/hooks/data/useAppSettings";
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
    <header className="grid h-12 shrink-0 grid-cols-[1fr_minmax(0,768px)_1fr] items-center gap-4 border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-900">
      {/* Left section - branding */}
      <div className="flex items-center gap-3 justify-self-start">
        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} />
        </button>
        <Link
          href="/"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
        >
          writr
        </Link>
        {projectTitle && (
          <>
            <span className="text-neutral-300 dark:text-neutral-600">/</span>
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {projectTitle}
            </span>
          </>
        )}
      </div>

      {/* Center section - search bar */}
      {activeProjectId ? (
        <div className="w-full max-w-xl justify-self-center">
          <SearchBar />
        </div>
      ) : (
        <div />
      )}

      {/* Right section - actions */}
      <div className="flex items-center gap-4 justify-self-end">
        {activeDocumentId && (
          <>
            <span className="whitespace-nowrap text-xs text-neutral-400 dark:text-neutral-500">
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
                openModal({
                  id: "export",
                  projectId: activeProjectId,
                  scope: "book",
                })
              }
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-neutral-600 transition-all duration-150 hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <Download size={14} />
              Export
            </button>
            <button
              type="button"
              onClick={openSprintConfig}
              disabled={!!activeSprintId}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-neutral-400 ${
                activeSprintId
                  ? "cursor-not-allowed opacity-50"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              }`}
            >
              <Timer size={14} />
              Sprint
            </button>
          </>
        )}
        {settings?.enableAiFeatures && (
          <button
            type="button"
            onClick={toggleAiPanel}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-neutral-400 ${
              aiPanelOpen
                ? "bg-primary-600 text-white dark:bg-primary-500 dark:text-white"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            <Sparkles size={14} />
            AI
          </button>
        )}
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
        status === "error"
          ? "text-red-500"
          : "text-neutral-400 dark:text-neutral-500"
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
