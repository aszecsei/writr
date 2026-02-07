"use client";

import { Calendar } from "lucide-react";
import Link from "next/link";
import type { Project } from "@/db/schemas";

interface ProjectCardProps {
  project: Project;
  onContextMenu?: (e: React.MouseEvent, projectId: string) => void;
}

export function ProjectCard({ project, onContextMenu }: ProjectCardProps) {
  const updatedDate = new Date(project.updatedAt).toLocaleDateString();

  return (
    <Link
      href={`/projects/${project.id}`}
      onContextMenu={
        onContextMenu ? (e) => onContextMenu(e, project.id) : undefined
      }
      className="group block rounded-xl border border-neutral-200 bg-white p-6 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h3 className="text-lg font-semibold text-neutral-900 group-hover:text-neutral-700 dark:text-neutral-100 dark:group-hover:text-neutral-300">
        {project.title}
      </h3>
      {project.genre && (
        <span className="mt-1 inline-block rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
          {project.genre}
        </span>
      )}
      {project.description && (
        <p className="mt-2 line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">
          {project.description}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500">
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          Updated {updatedDate}
        </span>
        {project.targetWordCount > 0 && (
          <span>{project.targetWordCount.toLocaleString()} words target</span>
        )}
      </div>
    </Link>
  );
}
