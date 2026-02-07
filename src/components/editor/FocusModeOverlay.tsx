"use client";

import { X } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { useSprintStore } from "@/store/sprintStore";
import { useUiStore } from "@/store/uiStore";

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function FocusModeOverlay() {
  const wordCount = useEditorStore((s) => s.wordCount);
  const setFocusMode = useUiStore((s) => s.setFocusMode);

  const activeSprintId = useSprintStore((s) => s.activeSprintId);
  const isRunning = useSprintStore((s) => s.isRunning);
  const isPaused = useSprintStore((s) => s.isPaused);
  const remainingMs = useSprintStore((s) => s.remainingMs);
  const wordsWritten = useSprintStore((s) => s.wordsWritten);

  const hasActiveSprint = activeSprintId !== null;

  return (
    <div className="fixed right-4 top-4 z-50 flex items-center gap-3 rounded-lg border border-neutral-200/50 bg-white/80 px-4 py-2 shadow-sm backdrop-blur-sm transition-opacity hover:opacity-100 dark:border-neutral-700/50 dark:bg-neutral-900/80">
      {/* Sprint info (if active) */}
      {hasActiveSprint && (
        <>
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                isRunning
                  ? "animate-pulse bg-green-500"
                  : isPaused
                    ? "bg-yellow-500"
                    : "bg-neutral-400"
              }`}
            />
            <span className="font-mono text-sm font-medium tabular-nums text-neutral-700 dark:text-neutral-300">
              {formatTime(remainingMs)}
            </span>
          </div>
          <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            +{wordsWritten} words
          </span>
          <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
        </>
      )}

      {/* Word count */}
      <span className="text-sm text-neutral-600 dark:text-neutral-400">
        {wordCount.toLocaleString()} words
      </span>

      {/* Exit button */}
      <button
        type="button"
        onClick={() => setFocusMode(false)}
        className="ml-1 rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
        aria-label="Exit focus mode"
        title="Exit focus mode (Esc)"
      >
        <X size={16} />
      </button>
    </div>
  );
}
