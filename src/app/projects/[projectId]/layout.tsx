"use client";

import { useParams } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { HostProjectMirror } from "@/components/collab/HostProjectMirror";
import { AppShell } from "@/components/layout/AppShell";
import { Spinner } from "@/components/ui/Spinner";
import type { ProjectId } from "@/db/schemas";
import { useProject } from "@/hooks/data/useProject";
import { collabSelectors, useCollabStore } from "@/store/collabStore";
import { useProjectStore } from "@/store/projectStore";

export default function ProjectLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ projectId: ProjectId }>();
  const project = useProject(params.projectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const clearActiveProject = useProjectStore((s) => s.clearActiveProject);
  const isHost = useCollabStore(collabSelectors.isHost);
  const isProjectMode = useCollabStore(collabSelectors.isProjectMode);

  useEffect(() => {
    if (project) {
      setActiveProject(project.id, project.title, project.mode);
    }
    return () => {
      clearActiveProject();
    };
  }, [project, setActiveProject, clearActiveProject]);

  if (project === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
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

  return (
    <AppShell>
      {isHost && isProjectMode && (
        <HostProjectMirror projectId={params.projectId} />
      )}
      {children}
    </AppShell>
  );
}
