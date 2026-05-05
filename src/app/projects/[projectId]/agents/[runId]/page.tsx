"use client";

import { useParams } from "next/navigation";
import { RunDashboard } from "@/components/agents/RunDashboard";

export default function RunDashboardPage() {
  const params = useParams<{ projectId: string; runId: string }>();
  return <RunDashboard runId={params.runId} projectId={params.projectId} />;
}
