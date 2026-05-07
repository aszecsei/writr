"use client";

import { useParams } from "next/navigation";
import { RunDashboard } from "@/components/agents/RunDashboard";
import type { AgentRunId, ProjectId } from "@/db/schemas";

export default function RunDashboardPage() {
  const params = useParams<{ projectId: ProjectId; runId: AgentRunId }>();
  return <RunDashboard runId={params.runId} projectId={params.projectId} />;
}
