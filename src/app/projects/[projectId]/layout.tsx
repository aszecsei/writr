"use client";

import { useParams } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useProject } from "@/hooks/useProject";
import { useProjectStore } from "@/store/projectStore";

export default function ProjectLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ projectId: string }>();
  const project = useProject(params.projectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const clearActiveProject = useProjectStore((s) => s.clearActiveProject);

  useEffect(() => {
    if (project) {
      setActiveProject(project.id, project.title);
    }
    return () => {
      clearActiveProject();
    };
  }, [project, setActiveProject, clearActiveProject]);

  if (project === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-600 dark:border-neutral-700 dark:border-t-primary-400" />
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-neutral-500">Project not found.</p>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
