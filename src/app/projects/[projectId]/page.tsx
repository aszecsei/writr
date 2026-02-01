"use client";

import { useParams } from "next/navigation";
import { useChaptersByProject } from "@/hooks/useChapter";
import { useProject } from "@/hooks/useProject";

export default function ProjectOverviewPage() {
  const params = useParams<{ projectId: string }>();
  const project = useProject(params.projectId);
  const chapters = useChaptersByProject(params.projectId);

  if (!project) return null;

  const totalWords = chapters?.reduce((sum, ch) => sum + ch.wordCount, 0) ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        {project.title}
      </h2>
      {project.genre && (
        <span className="mt-2 inline-block rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {project.genre}
        </span>
      )}
      {project.description && (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          {project.description}
        </p>
      )}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Chapters" value={chapters?.length ?? 0} />
        <StatCard label="Total Words" value={totalWords.toLocaleString()} />
        {project.targetWordCount > 0 && (
          <StatCard
            label="Progress"
            value={`${Math.min(100, Math.round((totalWords / project.targetWordCount) * 100))}%`}
          />
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
    </div>
  );
}
