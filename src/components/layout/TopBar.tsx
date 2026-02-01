"use client";

import Link from "next/link";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";

export function TopBar() {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const toggleAiPanel = useUiStore((s) => s.toggleAiPanel);
  const aiPanelOpen = useUiStore((s) => s.aiPanelOpen);
  const projectTitle = useProjectStore((s) => s.activeProjectTitle);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const wordCount = useEditorStore((s) => s.wordCount);
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label="Toggle sidebar"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            role="img"
            aria-label="Toggle sidebar"
          >
            <path d="M3 4.5h12M3 9h12M3 13.5h12" />
          </svg>
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
              {wordCount.toLocaleString()} words
            </span>
            <SaveStatusIndicator status={saveStatus} />
          </>
        )}
        <button
          type="button"
          onClick={toggleAiPanel}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            aiPanelOpen
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
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
  const label = {
    idle: "",
    saving: "Saving...",
    saved: "Saved",
    error: "Save failed",
  }[status];

  if (!label) return null;

  return (
    <span
      className={`text-xs ${
        status === "error" ? "text-red-500" : "text-zinc-400 dark:text-zinc-500"
      }`}
    >
      {label}
    </span>
  );
}
