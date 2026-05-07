"use client";

import { useParams } from "next/navigation";
import { ProjectOverviewBody } from "@/components/projects/ProjectOverviewBody";
import type { ProjectId } from "@/db/schemas";

export default function ProjectOverviewPage() {
  const params = useParams<{ projectId: ProjectId }>();
  return <ProjectOverviewBody projectId={params.projectId} readOnly={false} />;
}
