import { db } from "../database";
import {
  type EditPlan,
  EditPlanSchema,
  type EditPlanStatus,
  type EditPlanTier,
} from "../schemas";
import { generateId, now } from "./helpers";

export async function getEditPlanByRun(
  runId: string,
): Promise<EditPlan | undefined> {
  return db.editPlans.where({ runId }).first();
}

export async function getEditPlan(id: string): Promise<EditPlan | undefined> {
  return db.editPlans.get(id);
}

export interface UpsertEditPlanInput {
  projectId: string;
  runId: string;
  status?: EditPlanStatus;
  currentTier?: number;
  tiers?: EditPlanTier[];
}

/**
 * One plan per run. Creates if missing, otherwise patches the existing row.
 * Used by the orchestrator's `finalize_tier` tool to commit a tier definition.
 */
export async function upsertEditPlan(
  input: UpsertEditPlanInput,
): Promise<EditPlan> {
  const existing = await getEditPlanByRun(input.runId);
  const timestamp = now();
  if (existing) {
    const patched: EditPlan = {
      ...existing,
      status: input.status ?? existing.status,
      currentTier: input.currentTier ?? existing.currentTier,
      tiers: input.tiers ?? existing.tiers,
      updatedAt: timestamp,
    };
    await db.editPlans.put(patched);
    return patched;
  }
  const next = EditPlanSchema.parse({
    id: generateId(),
    projectId: input.projectId,
    runId: input.runId,
    status: input.status ?? "draft",
    currentTier: input.currentTier ?? 0,
    tiers: input.tiers ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.editPlans.add(next);
  return next;
}

/**
 * Replace (or insert) a single tier's record on the plan. Used by
 * `finalize_tier` to commit one tier without rewriting the others.
 */
export async function setEditPlanTier(
  runId: string,
  tier: EditPlanTier,
  projectId: string,
): Promise<EditPlan> {
  const existing = await getEditPlanByRun(runId);
  const tiers = existing ? [...existing.tiers] : [];
  const idx = tiers.findIndex((t) => t.tierNumber === tier.tierNumber);
  if (idx >= 0) tiers[idx] = tier;
  else tiers.push(tier);
  tiers.sort((a, b) => a.tierNumber - b.tierNumber);
  return upsertEditPlan({
    projectId,
    runId,
    status: existing?.status ?? "draft",
    currentTier: existing?.currentTier ?? 0,
    tiers,
  });
}

export async function updateEditPlanStatus(
  id: string,
  status: EditPlanStatus,
): Promise<void> {
  await db.editPlans.update(id, { status, updatedAt: now() });
}

export async function deleteEditPlan(id: string): Promise<void> {
  await db.editPlans.delete(id);
}
