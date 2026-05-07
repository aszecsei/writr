import { db } from "../database";
import {
  type AgentRunId,
  type WorkUnit,
  type WorkUnitId,
  WorkUnitSchema,
  type WorkUnitStatus,
} from "../schemas";
import { generateId, now } from "./helpers";

export type CreateWorkUnitInput = Omit<
  WorkUnit,
  "id" | "createdAt" | "updatedAt" | "status" | "ownerEditorMessageId"
> & {
  status?: WorkUnitStatus;
  ownerEditorMessageId?: string | null;
};

export async function createWorkUnit(
  input: CreateWorkUnitInput,
): Promise<WorkUnit> {
  const timestamp = now();
  const wu = WorkUnitSchema.parse({
    id: generateId(),
    projectId: input.projectId,
    runId: input.runId,
    tier: input.tier,
    goal: input.goal,
    requiredBeats: input.requiredBeats,
    constraints: input.constraints,
    placement: input.placement,
    targetLengthWords: input.targetLengthWords,
    bibleRefs: input.bibleRefs,
    sourceNoteIds: input.sourceNoteIds,
    dependencies: input.dependencies,
    status: input.status ?? "planned",
    ownerEditorMessageId: input.ownerEditorMessageId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.workUnits.add(wu);
  return wu;
}

export async function getWorkUnit(
  id: WorkUnitId,
): Promise<WorkUnit | undefined> {
  return db.workUnits.get(id);
}

export async function listWorkUnitsByRun(
  runId: AgentRunId,
): Promise<WorkUnit[]> {
  return db.workUnits.where({ runId }).sortBy("createdAt");
}

export async function listWorkUnitsByTier(
  runId: AgentRunId,
  tier: number,
): Promise<WorkUnit[]> {
  return db.workUnits
    .where("[runId+tier]")
    .equals([runId, tier])
    .sortBy("createdAt");
}

export async function updateWorkUnit(
  id: WorkUnitId,
  data: Partial<
    Pick<
      WorkUnit,
      | "goal"
      | "requiredBeats"
      | "constraints"
      | "placement"
      | "targetLengthWords"
      | "bibleRefs"
      | "sourceNoteIds"
      | "dependencies"
      | "status"
      | "tier"
      | "ownerEditorMessageId"
    >
  >,
): Promise<void> {
  await db.workUnits.update(id, { ...data, updatedAt: now() });
}

export async function deleteWorkUnit(id: WorkUnitId): Promise<void> {
  await db.workUnits.delete(id);
}
