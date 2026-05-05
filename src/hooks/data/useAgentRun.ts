"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { AgentRun } from "@/db/schemas";

export function useAgentRun(runId: string | null): AgentRun | undefined {
  return useLiveQuery(
    () => (runId ? db.agentRuns.get(runId) : undefined),
    [runId],
  );
}

export function useAgentRunsByProject(
  projectId: string | null,
): AgentRun[] | undefined {
  return useLiveQuery(
    () =>
      projectId
        ? db.agentRuns.where({ projectId }).reverse().sortBy("createdAt")
        : [],
    [projectId],
  );
}
