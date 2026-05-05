import { z } from "zod";
import { setEditPlanTier } from "@/db/operations/editPlans";
import {
  createWorkUnit,
  listWorkUnitsByTier,
  updateWorkUnit,
} from "@/db/operations/workUnits";
import { defineTool, type ToolResult } from "../types";

function ok(message: string, data?: Record<string, unknown>): ToolResult {
  return { success: true, message, data };
}

function fail(message: string): ToolResult {
  return { success: false, message };
}

const placementSchema = z.object({
  chapterId: z.string().uuid(),
  position: z.enum(["before", "after", "replace", "insert-at"]),
  anchorText: z.string().optional(),
  paragraphIndex: z.number().int().nonnegative().optional(),
  pov: z.string().optional(),
});

// ─── create_work_unit ───────────────────────────────────────────────

export const createWorkUnitTool = defineTool({
  id: "create_work_unit",
  name: "Create Work Unit",
  description:
    "Define a single editorial unit of work (a coherent scene addition / rewrite / cut / foreshadowing seed). " +
    "Use this when planning a tier — provide goal, required beats, constraints, placement, and source notes. " +
    'Pass JSON-encoded strings for arrays (e.g. requiredBeats="[\\"beat 1\\",\\"beat 2\\"]"). ' +
    "Placement is a JSON object: {chapterId, position, anchorText?, paragraphIndex?, pov?}.",
  parameters: {
    type: "object",
    properties: {
      tier: { type: "number", description: "Tier number (1-based)" },
      goal: { type: "string", description: "What this edit accomplishes" },
      requiredBeats: {
        type: "string",
        description: "JSON array of beats this unit must establish",
      },
      constraints: {
        type: "string",
        description: "JSON array of constraints (what NOT to contradict)",
      },
      placement: {
        type: "string",
        description:
          'JSON object: {"chapterId":"...","position":"before|after|replace|insert-at","anchorText"?:"...","paragraphIndex"?:N,"pov"?:"..."}',
      },
      targetLengthWords: {
        type: "number",
        description: "Approximate target word count",
      },
      bibleRefs: {
        type: "string",
        description: "JSON array of bible paths the editor should consult",
      },
      sourceNoteIds: {
        type: "string",
        description: "JSON array of agent-note ids this unit addresses",
      },
      dependencies: {
        type: "string",
        description:
          "JSON array of work-unit ids that must apply before this one",
      },
    },
    required: ["tier", "goal", "placement"],
  },
  inputSchema: z.object({
    tier: z.number().int().nonnegative(),
    goal: z.string().min(1),
    requiredBeats: z.string().optional(),
    constraints: z.string().optional(),
    placement: z.string(),
    targetLengthWords: z.number().int().nonnegative().optional(),
    bibleRefs: z.string().optional(),
    sourceNoteIds: z.string().optional(),
    dependencies: z.string().optional(),
  }),
  requiresApproval: false,
  async execute(params, context) {
    if (!context.runId) return fail("create_work_unit requires a run context");

    const placement = parseJson(params.placement, placementSchema);
    if (placement instanceof Error)
      return fail(`Invalid placement: ${placement.message}`);

    const arrays = {
      requiredBeats: parseStringArray(params.requiredBeats),
      constraints: parseStringArray(params.constraints),
      bibleRefs: parseStringArray(params.bibleRefs),
      sourceNoteIds: parseStringArray(params.sourceNoteIds),
      dependencies: parseStringArray(params.dependencies),
    };
    for (const [k, v] of Object.entries(arrays)) {
      if (v instanceof Error) return fail(`Invalid ${k}: ${v.message}`);
    }

    const wu = await createWorkUnit({
      projectId: context.projectId,
      runId: context.runId,
      tier: params.tier,
      goal: params.goal,
      placement,
      targetLengthWords: params.targetLengthWords ?? null,
      requiredBeats: arrays.requiredBeats as string[],
      constraints: arrays.constraints as string[],
      bibleRefs: arrays.bibleRefs as string[],
      sourceNoteIds: arrays.sourceNoteIds as string[],
      dependencies: arrays.dependencies as string[],
    });
    return ok(`Created work unit "${wu.goal.slice(0, 50)}…"`, {
      workUnitId: wu.id,
    });
  },
});

// ─── update_work_unit ───────────────────────────────────────────────

export const updateWorkUnitTool = defineTool({
  id: "update_work_unit",
  name: "Update Work Unit",
  description:
    "Patch fields on an existing work unit. Only include fields to change.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Work unit id" },
      goal: { type: "string" },
      requiredBeats: { type: "string", description: "JSON array" },
      constraints: { type: "string", description: "JSON array" },
      placement: { type: "string", description: "JSON object" },
      targetLengthWords: { type: "number" },
      bibleRefs: { type: "string", description: "JSON array" },
      dependencies: { type: "string", description: "JSON array" },
      tier: { type: "number" },
    },
    required: ["id"],
  },
  inputSchema: z.object({
    id: z.string().uuid(),
    goal: z.string().optional(),
    requiredBeats: z.string().optional(),
    constraints: z.string().optional(),
    placement: z.string().optional(),
    targetLengthWords: z.number().int().nonnegative().optional(),
    bibleRefs: z.string().optional(),
    dependencies: z.string().optional(),
    tier: z.number().int().nonnegative().optional(),
  }),
  requiresApproval: false,
  async execute(params, context) {
    if (!context.runId) return fail("update_work_unit requires a run context");

    const patch: Parameters<typeof updateWorkUnit>[1] = {};
    if (params.goal !== undefined) patch.goal = params.goal;
    if (params.tier !== undefined) patch.tier = params.tier;
    if (params.targetLengthWords !== undefined)
      patch.targetLengthWords = params.targetLengthWords;

    if (params.placement) {
      const parsed = parseJson(params.placement, placementSchema);
      if (parsed instanceof Error)
        return fail(`Invalid placement: ${parsed.message}`);
      patch.placement = parsed;
    }

    const arrayFields: Array<{
      raw: string | undefined;
      key: "requiredBeats" | "constraints" | "bibleRefs" | "dependencies";
    }> = [
      { raw: params.requiredBeats, key: "requiredBeats" },
      { raw: params.constraints, key: "constraints" },
      { raw: params.bibleRefs, key: "bibleRefs" },
      { raw: params.dependencies, key: "dependencies" },
    ];
    for (const { raw, key } of arrayFields) {
      if (raw === undefined) continue;
      const parsed = parseStringArray(raw);
      if (parsed instanceof Error)
        return fail(`Invalid ${key}: ${parsed.message}`);
      patch[key] = parsed;
    }

    await updateWorkUnit(params.id, patch);
    return ok("Updated work unit", { workUnitId: params.id });
  },
});

// ─── finalize_tier ──────────────────────────────────────────────────

export const finalizeTierTool = defineTool({
  id: "finalize_tier",
  name: "Finalize Tier",
  description:
    "Commit a tier definition to the edit plan. Lists every work-unit id in the tier (in execution order), " +
    "transitions the plan to 'awaiting plan approval', and stops the orchestrator. " +
    "Call this once per tier when planning is complete.",
  parameters: {
    type: "object",
    properties: {
      tier: { type: "number", description: "Tier number" },
      summary: {
        type: "string",
        description: "1-2 sentence rationale for this tier's goals",
      },
      workUnitIds: {
        type: "string",
        description: "JSON array of work-unit ids in execution order",
      },
    },
    required: ["tier", "workUnitIds"],
  },
  inputSchema: z.object({
    tier: z.number().int().nonnegative(),
    summary: z.string().optional(),
    workUnitIds: z.string(),
  }),
  requiresApproval: false,
  async execute(params, context) {
    if (!context.runId) return fail("finalize_tier requires a run context");
    const ids = parseStringArray(params.workUnitIds);
    if (ids instanceof Error)
      return fail(`Invalid workUnitIds: ${ids.message}`);

    // Sanity-check ids exist and belong to this tier.
    const tierUnits = await listWorkUnitsByTier(context.runId, params.tier);
    const tierUnitIds = new Set(tierUnits.map((u) => u.id));
    const missing = ids.filter((id) => !tierUnitIds.has(id));
    if (missing.length > 0) {
      return fail(
        `These work-unit ids are not in tier ${params.tier}: ${missing.join(", ")}`,
      );
    }

    await setEditPlanTier(
      context.runId,
      {
        tierNumber: params.tier,
        summary: params.summary ?? "",
        workUnitIds: ids,
      },
      context.projectId,
    );
    return ok(`Finalized tier ${params.tier} with ${ids.length} work units`, {
      tier: params.tier,
      workUnitIds: ids,
    });
  },
});

// ─── helpers ────────────────────────────────────────────────────────

function parseJson<T>(raw: string, schema: z.ZodType<T>): T | Error {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Error("not valid JSON");
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    return new Error(result.error.issues.map((i) => i.message).join("; "));
  }
  return result.data;
}

function parseStringArray(raw: string | undefined): string[] | Error {
  if (raw === undefined || raw.trim() === "") return [];
  return parseJson(raw, z.array(z.string()));
}
