"use client";

import Link from "next/link";
import type { Project } from "@/db/schemas";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const updatedDate = new Date(project.updatedAt).toLocaleDateString();

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block rounded-lg border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h3 className="text-lg font-semibold text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-100 dark:group-hover:text-zinc-300">
        {project.title}
      </h3>
      {project.genre && (
        <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {project.genre}
        </span>
      )}
      {project.description && (
        <p className="mt-2 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
          {project.description}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
        <span>Updated {updatedDate}</span>
        {project.targetWordCount > 0 && (
          <span>{project.targetWordCount.toLocaleString()} words target</span>
        )}
      </div>
    </Link>
  );
}
