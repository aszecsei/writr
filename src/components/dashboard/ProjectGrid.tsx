"use client";

import { BookOpen, Plus } from "lucide-react";
import type { Project, ProjectId } from "@/db/schemas";
import { ProjectCard } from "./ProjectCard";

interface ProjectGridProps {
  projects: Project[];
  onContextMenu?: (e: React.MouseEvent, projectId: ProjectId) => void;
  onCreateProject?: () => void;
}

export function ProjectGrid({
  projects,
  onContextMenu,
  onCreateProject,
}: ProjectGridProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white/50 px-6 py-20 text-center dark:border-neutral-700 dark:bg-neutral-900/40">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 ring-1 ring-primary-200/60 dark:from-primary-950 dark:to-primary-900/40 dark:ring-primary-800/50">
          <BookOpen
            size={26}
            className="text-primary-600 dark:text-primary-400"
          />
        </div>
        <p className="text-base font-medium text-neutral-900 dark:text-neutral-100">
          Your shelf is empty
        </p>
        <p className="mt-1 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
          Start a new project to begin writing — drafts, novels, or screenplays.
        </p>
        {onCreateProject && (
          <button
            type="button"
            onClick={onCreateProject}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 dark:bg-primary-500 dark:hover:bg-primary-400"
          >
            <Plus size={16} />
            Create your first project
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}
