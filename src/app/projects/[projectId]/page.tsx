"use client";

import type { LucideIcon } from "lucide-react";
import { Calendar, Clock, FileText, Pencil, Target, Type } from "lucide-react";
import { useParams } from "next/navigation";
import { EditProjectDialog } from "@/components/dashboard/EditProjectDialog";
import { WritingStatsDashboard } from "@/components/stats";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import { useChaptersByProject } from "@/hooks/data/useChapter";
import { useProject } from "@/hooks/data/useProject";
import { useWritingStats } from "@/hooks/editor/useWritingStats";
import { formatReadingTime } from "@/lib/reading-time";
import { getTerm } from "@/lib/terminology";
import { useUiStore } from "@/store/uiStore";

export default function ProjectOverviewPage() {
  const params = useParams<{ projectId: string }>();
  const project = useProject(params.projectId);
  const chapters = useChaptersByProject(params.projectId);
  const stats = useWritingStats(params.projectId);
  const appSettings = useAppSettings();
  const openModal = useUiStore((s) => s.openModal);

  if (!project) return null;

  const totalWords = chapters?.reduce((sum, ch) => sum + ch.wordCount, 0) ?? 0;

  return (
    <div className="mx-auto max-w-editor px-8 py-8">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          {project.title}
        </h2>
        <button
          type="button"
          onClick={() =>
            openModal({ id: "edit-project", projectId: params.projectId })
          }
          className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          aria-label="Edit project"
        >
          <Pencil size={16} />
        </button>
      </div>
      {project.genre && (
        <span className="mt-2 inline-block rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
          {project.genre}
        </span>
      )}
      {project.description && (
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
          {project.description}
        </p>
      )}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          label={getTerm(project.mode, "chapters")}
          value={chapters?.length ?? 0}
          icon={FileText}
        />
        <StatCard
          label="Total Words"
          value={totalWords.toLocaleString()}
          icon={Type}
        />
        <StatCard
          label="Reading Time"
          value={formatReadingTime(totalWords)}
          icon={Clock}
        />
        {project.targetWordCount > 0 && (
          <StatCard
            label="Progress"
            value={`${Math.min(100, Math.round((totalWords / project.targetWordCount) * 100))}%`}
            icon={Target}
          />
        )}
        {project.targetWordCount > 0 &&
          totalWords < project.targetWordCount &&
          stats?.averageWordsPerDay != null &&
          stats.averageWordsPerDay > 0 &&
          appSettings?.goalCountdownDisplay !== "off" && (
            <StatCard
              label={
                appSettings?.goalCountdownDisplay === "time-remaining"
                  ? "Est. Time to Goal"
                  : "Est. Completion"
              }
              value={(() => {
                const days =
                  (project.targetWordCount - totalWords) /
                  stats.averageWordsPerDay;
                if (appSettings?.goalCountdownDisplay === "time-remaining") {
                  return formatEstimatedTime(days);
                }
                return formatEstimatedDate(days);
              })()}
              icon={Calendar}
            />
          )}
      </div>

      {/* Writing Statistics Dashboard */}
      <div className="mt-8">
        <h3 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Writing Activity
        </h3>
        <WritingStatsDashboard projectId={params.projectId} />
      </div>

      <EditProjectDialog />
    </div>
  );
}

function formatEstimatedDate(days: number): string {
  const target = new Date(Date.now() + days * 86_400_000);
  return target.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatEstimatedTime(days: number): string {
  if (days < 1) return "< 1 day";
  if (days < 61) {
    const rounded = Math.round(days);
    return rounded === 1 ? "~1 day" : `~${rounded} days`;
  }
  if (days < 365) {
    const months = Math.round((days / 30.44) * 2) / 2;
    return `~${months} months`;
  }
  const years = Math.round((days / 365.25) * 2) / 2;
  return years === 1 ? "~1 year" : `~${years} years`;
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 transition-all duration-150 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
        <Icon size={16} />
      </div>
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        {value}
      </p>
    </div>
  );
}
