"use client";

import type { LucideIcon } from "lucide-react";
import { Calendar, Clock, FileText, Pencil, Target, Type } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { EditProjectDialog } from "@/components/dashboard/EditProjectDialog";
import { WritingStatsDashboard } from "@/components/stats";
import type { ProjectId } from "@/db/schemas";
import { useChaptersByProject, useProject } from "@/hooks/data/source";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import { useWritingStats } from "@/hooks/editor/useWritingStats";
import { formatReadingTime } from "@/lib/reading-time";
import { getTerm } from "@/lib/terminology";
import { useUiStore } from "@/store/uiStore";

export interface ProjectOverviewBodyProps {
  projectId: ProjectId;
  readOnly: boolean;
}

export function ProjectOverviewBody({
  projectId,
  readOnly,
}: ProjectOverviewBodyProps) {
  const project = useProject(projectId);
  const chapters = useChaptersByProject(projectId);
  // Writing stats and app settings come from Dexie only; guests don't see
  // them since their stats are scoped to their local IndexedDB.
  const stats = useWritingStats(readOnly ? null : projectId);
  const appSettings = useAppSettings();
  const openModal = useUiStore((s) => s.openModal);

  if (!project) return null;

  const totalWords = chapters?.reduce((sum, ch) => sum + ch.wordCount, 0) ?? 0;
  const updatedDate = new Date(project.updatedAt).toLocaleDateString();
  const progressPercent =
    project.targetWordCount > 0
      ? Math.min(100, Math.round((totalWords / project.targetWordCount) * 100))
      : null;

  return (
    <div className="mx-auto max-w-editor px-8 py-8">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1
            className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
            style={{ fontFamily: "var(--font-literata), Georgia, serif" }}
          >
            {project.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-neutral-500 dark:text-neutral-400">
            {project.genre && (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                {project.genre}
              </span>
            )}
            <span className="flex items-center gap-1.5 tabular-nums">
              <Calendar size={12} />
              Updated {updatedDate}
            </span>
          </div>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => openModal({ id: "edit-project", projectId })}
            className="-mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            aria-label="Edit project"
          >
            <Pencil size={16} />
          </button>
        )}
      </header>

      {project.description && (
        <div className="prose prose-sm prose-neutral mt-4 [--tw-prose-body:var(--color-neutral-600)] dark:prose-invert dark:[--tw-prose-body:var(--color-neutral-400)]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {project.description}
          </ReactMarkdown>
        </div>
      )}

      <section className="mt-10">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">
          Overview
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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
          {progressPercent !== null && (
            <StatCard
              label="Progress"
              value={`${progressPercent}%`}
              icon={Target}
              progress={progressPercent}
            />
          )}
          {!readOnly &&
            project.targetWordCount > 0 &&
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
      </section>

      {!readOnly && (
        <section className="mt-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">
            Writing Activity
          </h2>
          <WritingStatsDashboard projectId={projectId} />
        </section>
      )}

      {!readOnly && <EditProjectDialog />}
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
  progress,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  progress?: number;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 transition-all duration-200 hover:border-neutral-300 hover:shadow-md hover:shadow-neutral-900/5 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700 dark:hover:shadow-black/20">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
        <Icon size={16} />
      </div>
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
        {value}
      </p>
      {progress !== undefined && (
        <div
          className="mt-3 h-1 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Word count progress"
        >
          <div
            className="h-full rounded-full bg-primary-500 transition-all duration-300 dark:bg-primary-400"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
