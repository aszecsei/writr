"use client";

import { useParams } from "next/navigation";
import { AgentsPageBody } from "@/components/agents/AgentsPageBody";
import type { ProjectId } from "@/db/schemas";

export default function AgentsOverviewPage() {
  const params = useParams<{ projectId: ProjectId }>();
  return <AgentsPageBody projectId={params.projectId} />;
}
