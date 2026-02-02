"use client";

import { BookOpen } from "lucide-react";
import type { Project } from "@/db/schemas";
import { ProjectCard } from "./ProjectCard";

interface ProjectGridProps {
  projects: Project[];
  onContextMenu?: (e: React.MouseEvent, projectId: string) => void;
}

export function ProjectGrid({ projects, onContextMenu }: ProjectGridProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <BookOpen size={24} className="text-zinc-400 dark:text-zinc-500" />
        </div>
        <p className="text-lg text-zinc-500 dark:text-zinc-400">
          No projects yet
        </p>
        <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
          Create your first project to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
