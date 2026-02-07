"use client";

import type { LucideIcon } from "lucide-react";
import { Clock, FileText, Pencil, Target, Type } from "lucide-react";
import { useParams } from "next/navigation";
import { EditProjectDialog } from "@/components/dashboard/EditProjectDialog";
import { WritingStatsDashboard } from "@/components/stats";
import { useChaptersByProject } from "@/hooks/useChapter";
import { useProject } from "@/hooks/useProject";
import { formatReadingTime } from "@/lib/reading-time";
import { useUiStore } from "@/store/uiStore";

export default function ProjectOverviewPage() {
  const params = useParams<{ projectId: string }>();
  const project = useProject(params.projectId);
  const chapters = useChaptersByProject(params.projectId);
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
          label="Chapters"
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
