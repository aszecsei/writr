"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type {
  EditPlan,
  ProposedEdit,
  ProposedEditStatus,
  WorkUnit,
} from "@/db/schemas";

export function useEditPlan(runId: string | null): EditPlan | undefined {
  return useLiveQuery(
    () => (runId ? db.editPlans.where({ runId }).first() : undefined),
    [runId],
  );
}

export function useWorkUnitsByRun(
  runId: string | null,
): WorkUnit[] | undefined {
  return useLiveQuery(async () => {
    if (!runId) return [];
    return db.workUnits.where({ runId }).sortBy("createdAt");
  }, [runId]);
}

export function useWorkUnitsByTier(
  runId: string | null,
  tier: number | null,
): WorkUnit[] | undefined {
  return useLiveQuery(async () => {
    if (!runId || tier === null) return [];
    return db.workUnits
      .where("[runId+tier]")
      .equals([runId, tier])
      .sortBy("createdAt");
  }, [runId, tier]);
}

export function useProposedEditsByRun(
  runId: string | null,
  status?: ProposedEditStatus,
): ProposedEdit[] | undefined {
  return useLiveQuery(async () => {
    if (!runId) return [];
    const all = await db.proposedEdits.where({ runId }).toArray();
    const filtered = status ? all.filter((e) => e.status === status) : all;
    return filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [runId, status]);
}

export function useProposedEditsByWorkUnit(
  workUnitId: string | null,
): ProposedEdit[] | undefined {
  return useLiveQuery(async () => {
    if (!workUnitId) return [];
    return db.proposedEdits.where({ workUnitId }).sortBy("createdAt");
  }, [workUnitId]);
}
