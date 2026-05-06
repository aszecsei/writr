import { z } from "zod";
import { createVerification } from "@/db/operations/verifications";
import { getWorkUnit } from "@/db/operations/workUnits";
import { AgentReferenceKindEnum } from "@/db/schemas";
import { defineTool } from "../types";
import { fail, ok } from "./helpers";

const findingsArraySchema = z.array(
  z.object({
    description: z.string().min(1),
    references: z
      .array(
        z.object({
          kind: AgentReferenceKindEnum,
          id: z.string(),
          locator: z.string().optional(),
        }),
      )
      .optional(),
  }),
);
type Findings = z.infer<typeof findingsArraySchema>;

function parseFindings(raw: string | undefined): Findings | Error {
  if (raw === undefined || raw.trim() === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Error("findings must be a JSON-encoded array");
  }
  const result = findingsArraySchema.safeParse(parsed);
  if (!result.success) {
    return new Error(result.error.issues.map((i) => i.message).join("; "));
  }
  return result.data;
}

// ─── report_verification ────────────────────────────────────────────

export const reportVerificationTool = defineTool({
  id: "report_verification",
  category: "verification",
  name: "Report Verification",
  description:
    "Record a verification result. Call ONCE per work unit (workUnitId set), and once tier-wide (workUnitId omitted) for cross-cutting drift. " +
    "Pass findings as JSON-encoded arrays of {description, references?}. " +
    "Empty findings array = no issues found in that category.",
  parameters: {
    type: "object",
    properties: {
      tier: { type: "number", description: "Tier number being verified" },
      workUnitId: {
        type: "string",
        description:
          "Work unit being verified. Omit for tier-wide drift report.",
      },
      goalAchieved: {
        type: "boolean",
        description:
          "Did the work unit accomplish its stated goal? Required when workUnitId is set.",
      },
      contradictions: {
        type: "string",
        description: "JSON array of contradictions with the reader bible.",
      },
      continuityBreaks: {
        type: "string",
        description: "JSON array of continuity issues with adjacent chapters.",
      },
      voiceMismatches: {
        type: "string",
        description: "JSON array of voice/style drift findings.",
      },
      notes: {
        type: "string",
        description: "JSON array of free-form verifier observation strings.",
      },
    },
    required: ["tier", "goalAchieved"],
  },
  inputSchema: z.object({
    tier: z.number().int().nonnegative(),
    workUnitId: z.string().uuid().optional(),
    goalAchieved: z.boolean(),
    contradictions: z.string().optional(),
    continuityBreaks: z.string().optional(),
    voiceMismatches: z.string().optional(),
    notes: z.string().optional(),
  }),
  requiresApproval: false,
  async execute(params, context) {
    if (!context.runId)
      return fail("report_verification requires a run context");

    if (params.workUnitId) {
      const wu = await getWorkUnit(params.workUnitId);
      if (!wu) return fail(`Work unit not found: ${params.workUnitId}`);
      if (wu.runId !== context.runId)
        return fail("Work unit belongs to a different run");
    }

    const contradictions = parseFindings(params.contradictions);
    if (contradictions instanceof Error)
      return fail(`Invalid contradictions: ${contradictions.message}`);
    const continuityBreaks = parseFindings(params.continuityBreaks);
    if (continuityBreaks instanceof Error)
      return fail(`Invalid continuityBreaks: ${continuityBreaks.message}`);
    const voiceMismatches = parseFindings(params.voiceMismatches);
    if (voiceMismatches instanceof Error)
      return fail(`Invalid voiceMismatches: ${voiceMismatches.message}`);

    let notes: string[] = [];
    if (params.notes && params.notes.trim() !== "") {
      try {
        const parsed = JSON.parse(params.notes);
        const result = z.array(z.string()).safeParse(parsed);
        if (!result.success) {
          return fail("notes must be a JSON array of strings");
        }
        notes = result.data;
      } catch {
        return fail("notes must be valid JSON");
      }
    }

    const verification = await createVerification({
      projectId: context.projectId,
      runId: context.runId,
      tier: params.tier,
      workUnitId: params.workUnitId ?? null,
      goalAchieved: params.goalAchieved,
      contradictions: contradictions.map((f) => ({
        description: f.description,
        references: f.references ?? [],
      })),
      continuityBreaks: continuityBreaks.map((f) => ({
        description: f.description,
        references: f.references ?? [],
      })),
      voiceMismatches: voiceMismatches.map((f) => ({
        description: f.description,
        references: f.references ?? [],
      })),
      notes,
    });

    return ok(
      params.workUnitId
        ? `Verified work unit (${params.goalAchieved ? "goal achieved" : "goal MISSED"})`
        : `Recorded tier-wide drift report`,
      { verificationId: verification.id },
    );
  },
});
