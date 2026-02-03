"use client";

import { History, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { deleteSprint } from "@/db/operations";
import type { WritingSprint } from "@/db/schemas";
import { useSprintHistory, useSprintStats } from "@/hooks/useSprintHistory";
import { useProjectStore } from "@/store/projectStore";
import { useSprintStore } from "@/store/sprintStore";

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SprintHistoryItem({ sprint }: { sprint: WritingSprint }) {
  const wordsWritten =
    sprint.endWordCount !== null
      ? Math.max(0, sprint.endWordCount - sprint.startWordCount)
      : 0;

  const actualDuration =
    sprint.endedAt && sprint.startedAt
      ? new Date(sprint.endedAt).getTime() -
        new Date(sprint.startedAt).getTime() -
        sprint.totalPausedMs
      : 0;

  const wpm =
    actualDuration > 0
      ? Math.round((wordsWritten / actualDuration) * 60000)
      : 0;

  async function handleDelete() {
    await deleteSprint(sprint.id);
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-700">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {wordsWritten.toLocaleString()} words
          </span>
          {sprint.status === "abandoned" && (
            <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
              abandoned
            </span>
          )}
          {sprint.wordCountGoal && wordsWritten >= sprint.wordCountGoal && (
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
              goal reached
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{formatDate(sprint.startedAt)}</span>
          <span>{formatDuration(actualDuration)}</span>
          <span>{wpm} wpm</span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDelete}
        className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        aria-label="Delete sprint"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function SprintHistoryModal() {
  const historyModalOpen = useSprintStore((s) => s.historyModalOpen);
  const closeHistoryModal = useSprintStore((s) => s.closeHistoryModal);
  const projectId = useProjectStore((s) => s.activeProjectId);

  const sprints = useSprintHistory(projectId);
  const stats = useSprintStats(projectId);

  if (!historyModalOpen) return null;

  return (
    <Modal onClose={closeHistoryModal} maxWidth="max-w-lg">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        <History size={18} />
        Sprint History
      </h2>

      {/* Stats summary */}
      {stats && stats.totalSprints > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {stats.totalSprints}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              sprints
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {stats.totalWordsWritten.toLocaleString()}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              words
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {stats.averageWpm}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              avg wpm
            </span>
          </div>
        </div>
      )}

      {/* Sprint list */}
      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
        {sprints === undefined ? (
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            Loading...
          </p>
        ) : sprints.length === 0 ? (
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            No completed sprints yet. Start your first sprint to track your
            progress.
          </p>
        ) : (
          sprints.map((sprint) => (
            <SprintHistoryItem key={sprint.id} sprint={sprint} />
          ))
        )}
      </div>

      {/* Close button */}
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={closeHistoryModal}
          className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
