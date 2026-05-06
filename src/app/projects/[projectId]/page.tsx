"use client";

import { useParams } from "next/navigation";
import { ProjectOverviewBody } from "@/components/projects/ProjectOverviewBody";

export default function ProjectOverviewPage() {
  const params = useParams<{ projectId: string }>();
  return <ProjectOverviewBody projectId={params.projectId} readOnly={false} />;
}
