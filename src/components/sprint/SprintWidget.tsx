"use client";

import { Pause, Play, Square } from "lucide-react";
import { useWritingSprint } from "@/hooks/writing/useWritingSprint";
import { useSprintStore } from "@/store/sprintStore";

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function SprintWidget() {
  const activeSprintId = useSprintStore((s) => s.activeSprintId);
  const isRunning = useSprintStore((s) => s.isRunning);
  const isPaused = useSprintStore((s) => s.isPaused);
  const remainingMs = useSprintStore((s) => s.remainingMs);
  const elapsedMs = useSprintStore((s) => s.elapsedMs);
  const wordsWritten = useSprintStore((s) => s.wordsWritten);

  const { activeSprint, pause, resume, end } = useWritingSprint();

  if (!activeSprintId || !activeSprint) return null;

  const progress =
    activeSprint.durationMs > 0
      ? Math.min(100, (elapsedMs / activeSprint.durationMs) * 100)
      : 0;

  const goalProgress =
    activeSprint.wordCountGoal && activeSprint.wordCountGoal > 0
      ? Math.min(100, (wordsWritten / activeSprint.wordCountGoal) * 100)
      : null;

  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-4 rounded-full border border-neutral-200 bg-white px-5 py-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
        {/* Timer */}
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
          <span className="font-mono text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {formatTime(remainingMs)}
          </span>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700" />

        {/* Words written */}
        <div className="flex flex-col items-center">
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {wordsWritten.toLocaleString()}
          </span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {activeSprint.wordCountGoal
              ? `/ ${activeSprint.wordCountGoal} words`
              : "words"}
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex w-24 flex-col gap-1">
          {/* Time progress */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
            <div
              className="h-full rounded-full bg-primary-600 transition-all duration-300 dark:bg-primary-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Goal progress */}
          {goalProgress !== null && (
            <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  goalProgress >= 100 ? "bg-green-500" : "bg-blue-500"
                }`}
                style={{ width: `${goalProgress}%` }}
              />
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700" />

        {/* Controls */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              type="button"
              onClick={pause}
              className="rounded-full p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              aria-label="Pause sprint"
            >
              <Pause size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={resume}
              className="rounded-full p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              aria-label="Resume sprint"
            >
              <Play size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={() => end(true)}
            className="rounded-full p-2 text-neutral-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-neutral-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            aria-label="End sprint"
          >
            <Square size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
