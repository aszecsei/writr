import { createAgentNote } from "@/db/operations/agentNotes";
import {
  updateAgentRun,
  updateAgentRunStatus,
} from "@/db/operations/agentRuns";
import { getEditPlanByRun } from "@/db/operations/editPlans";
import { listProposedEditsByRun } from "@/db/operations/proposedEdits";
import { getAppSettings } from "@/db/operations/settings";
import { listVerificationsByTier } from "@/db/operations/verifications";
import { listWorkUnitsByTier } from "@/db/operations/workUnits";
import type {
  AgentNoteCategory,
  ProposedEdit,
  Verification,
  VerificationFinding,
  WorkUnit,
} from "@/db/schemas";
import type { AiContext } from "../../types";
import {
  makeVerifierAgent,
  type VerifierWorkUnitContext,
} from "../builtins/verifier";
import { resolveAgentModel, runAgent } from "../runner";
import type { RunAgentCallbacks } from "../types";
import type { PipelineEventEmitter } from "./events";

export interface VerifyTierOptions {
  runId: string;
  projectId: string;
  tier: number;
  /** Chapter ids touched by the tier — usually returned by applyTier. */
  affectedChapterIds: string[];
  signal?: AbortSignal;
  onEvent?: PipelineEventEmitter;
  buildContext: () => Promise<AiContext>;
}

export interface VerifyTierResult {
  verificationCount: number;
  newNoteCount: number;
  driftDetected: boolean;
}

/**
 * Run the verifier on a freshly-applied tier. Routes findings back as new
 * `agentNotes` so the next planning round picks them up. Sets the run's
 * `requiresIncrementalReread` flag when drift is detected — the UI then
 * blocks the next plan until the user runs an incremental Reader pass.
 */
export async function verifyTier(
  options: VerifyTierOptions,
): Promise<VerifyTierResult> {
  const {
    runId,
    projectId,
    tier,
    affectedChapterIds,
    signal,
    onEvent,
    buildContext,
  } = options;

  await updateAgentRunStatus(runId, "verifying-tier");

  const plan = await getEditPlanByRun(runId);
  if (!plan) throw new Error(`No edit plan for run ${runId}`);
  const planTier = plan.tiers.find((t) => t.tierNumber === tier);
  if (!planTier) throw new Error(`Tier ${tier} not on plan`);

  const tierUnits = await listWorkUnitsByTier(runId, tier);
  const byId = new Map(tierUnits.map((u) => [u.id, u]));
  const orderedUnits = planTier.workUnitIds
    .map((id) => byId.get(id))
    .filter((u): u is WorkUnit => !!u);

  const allEdits = await listProposedEditsByRun(runId);
  const appliedByUnit = new Map<string, ProposedEdit[]>();
  for (const edit of allEdits) {
    if (edit.status !== "applied") continue;
    const list = appliedByUnit.get(edit.workUnitId) ?? [];
    list.push(edit);
    appliedByUnit.set(edit.workUnitId, list);
  }

  // Skip verification if nothing was actually applied this tier.
  const verifierUnits: VerifierWorkUnitContext[] = orderedUnits
    .map((unit) => ({
      unit,
      appliedEdits: appliedByUnit.get(unit.id) ?? [],
    }))
    .filter((ctx) => ctx.appliedEdits.length > 0);

  if (verifierUnits.length === 0) {
    await updateAgentRunStatus(
      runId,
      "awaiting-plan-approval",
      `Tier ${tier} had no applied edits to verify.`,
    );
    return {
      verificationCount: 0,
      newNoteCount: 0,
      driftDetected: false,
    };
  }

  const settings = await getAppSettings();
  const context = await buildContext();
  const agent = makeVerifierAgent({
    runId,
    projectId,
    tier,
    workUnits: verifierUnits,
    affectedChapterIds,
    context,
  });

  const model = resolveAgentModel(agent, settings);
  if (!model.apiKey) {
    await updateAgentRunStatus(
      runId,
      "error",
      `No API key configured for provider '${model.provider}'.`,
    );
    throw new Error(`No API key configured for provider '${model.provider}'`);
  }

  const callbacks: RunAgentCallbacks = {
    onIterationStart: (info) =>
      onEvent?.({ type: "agent-iteration-start", runId, info }),
    onIterationEnd: (info) =>
      onEvent?.({ type: "agent-iteration-end", runId, info }),
    onToolCallsCollected: (info) =>
      onEvent?.({ type: "agent-tool-calls", runId, info }),
    onToolCallUpdate: (info) =>
      onEvent?.({ type: "agent-tool-update", runId, info }),
  };

  await runAgent({
    agent,
    userInput: undefined,
    history: [],
    model,
    stream: settings.streamResponses,
    signal,
    ...callbacks,
  });

  if (signal?.aborted) {
    await updateAgentRunStatus(
      runId,
      "cancelled",
      "Cancelled during verification",
    );
    return {
      verificationCount: 0,
      newNoteCount: 0,
      driftDetected: false,
    };
  }

  // Convert findings into new agentNotes so the orchestrator picks them up
  // when planning tier N+1. Drift detection bumps the incremental-reread flag.
  const verifications = await listVerificationsByTier(runId, tier);
  let newNoteCount = 0;
  let driftDetected = false;

  for (const v of verifications) {
    if (v.contradictions.length > 0 || v.continuityBreaks.length > 0) {
      driftDetected = true;
    }

    if (!v.goalAchieved && v.workUnitId) {
      const wu = byId.get(v.workUnitId);
      const description = wu
        ? `Verifier found goal not achieved for work unit "${wu.goal}". Re-plan or rewrite.`
        : "Verifier found goal not achieved (work unit unavailable).";
      await createAgentNote({
        projectId,
        runId,
        chapterId: wu?.placement.chapterId ?? null,
        category: "plot",
        severity: "major",
        description,
        references: wu ? [{ kind: "chapter", id: wu.placement.chapterId }] : [],
        sourceVerificationId: v.id,
      });
      newNoteCount += 1;
    }

    newNoteCount += await emitFindingNotes(
      v,
      projectId,
      runId,
      byId,
      "continuity",
      v.contradictions,
    );
    newNoteCount += await emitFindingNotes(
      v,
      projectId,
      runId,
      byId,
      "continuity",
      v.continuityBreaks,
    );
    newNoteCount += await emitFindingNotes(
      v,
      projectId,
      runId,
      byId,
      "voice",
      v.voiceMismatches,
    );
  }

  if (driftDetected) {
    await updateAgentRun(runId, { requiresIncrementalReread: true });
  }

  await updateAgentRunStatus(
    runId,
    "awaiting-plan-approval",
    driftDetected
      ? `Tier ${tier} verified — drift detected. Run an incremental Reader pass before planning tier ${tier + 1}.`
      : `Tier ${tier} verified — ${newNoteCount} new note${newNoteCount === 1 ? "" : "s"} for next planning round.`,
  );

  return {
    verificationCount: verifications.length,
    newNoteCount,
    driftDetected,
  };
}

async function emitFindingNotes(
  verification: Verification,
  projectId: string,
  runId: string,
  unitById: Map<string, WorkUnit>,
  category: AgentNoteCategory,
  findings: VerificationFinding[],
): Promise<number> {
  if (findings.length === 0) return 0;
  const wu = verification.workUnitId
    ? unitById.get(verification.workUnitId)
    : undefined;
  for (const f of findings) {
    await createAgentNote({
      projectId,
      runId,
      chapterId: wu?.placement.chapterId ?? null,
      category,
      severity: "major",
      description: f.description,
      references: f.references,
      sourceVerificationId: verification.id,
    });
  }
  return findings.length;
}
