"use client";

import { Calendar } from "lucide-react";
import Link from "next/link";
import type { Project, ProjectId } from "@/db/schemas";

interface ProjectCardProps {
  project: Project;
  onContextMenu?: (e: React.MouseEvent, projectId: ProjectId) => void;
}

export function ProjectCard({ project, onContextMenu }: ProjectCardProps) {
  const updatedDate = new Date(project.updatedAt).toLocaleDateString();

  return (
    <Link
      href={`/projects/${project.id}`}
      onContextMenu={
        onContextMenu ? (e) => onContextMenu(e, project.id) : undefined
      }
      className="group flex flex-col rounded-xl border border-neutral-200 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md hover:shadow-neutral-900/5 focus-visible:-translate-y-0.5 focus-visible:border-neutral-300 focus-visible:shadow-md focus-visible:shadow-neutral-900/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700 dark:hover:shadow-black/20 dark:focus-visible:border-neutral-700 dark:focus-visible:shadow-black/20"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-neutral-900 transition-colors group-hover:text-primary-700 dark:text-neutral-100 dark:group-hover:text-primary-400">
          {project.title}
        </h3>
        {project.genre && (
          <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            {project.genre}
          </span>
        )}
      </div>
      {project.description && (
        <p className="mt-2 line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">
          {project.description}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-5 text-xs text-neutral-400 dark:text-neutral-500">
        <span className="flex items-center gap-1.5">
          <Calendar size={12} />
          Updated {updatedDate}
        </span>
        {project.targetWordCount > 0 && (
          <span className="tabular-nums">
            {project.targetWordCount.toLocaleString()} word goal
          </span>
        )}
      </div>
    </Link>
  );
}
