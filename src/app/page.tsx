"use client";

import { Plus } from "lucide-react";
import { CreateProjectDialog } from "@/components/dashboard/CreateProjectDialog";
import { ProjectGrid } from "@/components/dashboard/ProjectGrid";
import { useAllProjects } from "@/hooks/useProject";
import { useUiStore } from "@/store/uiStore";

export default function DashboardPage() {
  const projects = useAllProjects();
  const openModal = useUiStore((s) => s.openModal);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            writr
          </h1>
          <button
            type="button"
            onClick={() => openModal("create-project")}
            className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Plus size={16} />
            New Project
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        {projects === undefined ? (
          <div className="flex justify-center py-24">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
          </div>
        ) : (
          <ProjectGrid projects={projects} />
        )}
      </main>
      <CreateProjectDialog />
    </div>
  );
}
