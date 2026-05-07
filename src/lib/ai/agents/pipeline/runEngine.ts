import { getAgentRun, markAgentRunFailed } from "@/db/operations/agentRuns";
import type { AgentRunStatus } from "@/db/schemas";
import type { AiContext } from "../../types";
import { type ApplyTierResult, applyTier } from "./applyTier";
import { getChaptersAwaitingReread } from "./driftDetect";
import type { PipelineEventEmitter } from "./events";
import { runReaderLoop } from "./readerLoop";
import { type RevertTierResult, revertTier } from "./revertTier";
import { executeTier, planTier } from "./tierRunner";
import { type VerifyTierResult, verifyTier } from "./verifyTier";

/**
 * Module-level registry of in-flight run controllers. The dashboard "Cancel"
 * button looks up the controller by runId and calls .abort(). Resume after a
 * page reload starts a new controller (no stale state to recover).
 */
const runControllers = new Map<string, AbortController>();

export function getRunController(runId: string): AbortController | undefined {
  return runControllers.get(runId);
}

export function cancelRun(runId: string): void {
  const controller = runControllers.get(runId);
  if (controller) controller.abort();
}

/**
 * Run a phase function and persist any thrown error onto the AgentRun row so
 * the dashboard can offer a Retry button. `phase` is the active status the
 * run is in while `fn` is executing — retry will re-enter at this status.
 *
 * User-initiated cancellation (signal.aborted) is treated as a normal abort,
 * not a failure: we re-throw without touching status so the caller's
 * cancel-path (which sets status="cancelled") wins.
 */
async function withRunErrorCapture<T>(
  runId: string,
  phase: AgentRunStatus,
  signal: AbortSignal,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (signal.aborted) throw err;
    const message = err instanceof Error ? err.message : String(err);
    await markAgentRunFailed(runId, message, phase);
    throw err;
  }
}

export interface StartReaderPhaseOptions {
  runId: string;
  projectId: string;
  chapterIdsInScope?: string[];
  maxPasses?: number;
  deltaThreshold?: number;
  onEvent?: PipelineEventEmitter;
  /**
   * Builds the AiContext for prompts. Caller wires up live data hooks; the
   * engine treats this as opaque and just forwards to agents.
   */
  buildContext: () => Promise<AiContext>;
}

/**
 * Phase 1 entry point: kick off the reading phase of a run. Phases 2–3 add
 * planTier(), executeTier(), verifyTier() to this same module.
 */
export async function startReaderPhase(
  options: StartReaderPhaseOptions,
): Promise<void> {
  const existing = runControllers.get(options.runId);
  if (existing) {
    throw new Error(
      `Run ${options.runId} is already in flight. Cancel it before restarting.`,
    );
  }
  const run = await getAgentRun(options.runId);
  if (!run) throw new Error(`Agent run not found: ${options.runId}`);

  const controller = new AbortController();
  runControllers.set(options.runId, controller);

  try {
    await withRunErrorCapture(options.runId, "reading", controller.signal, () =>
      runReaderLoop({
        runId: options.runId,
        projectId: options.projectId,
        chapterIdsInScope: options.chapterIdsInScope,
        maxPasses: options.maxPasses,
        deltaThreshold: options.deltaThreshold,
        signal: controller.signal,
        onEvent: options.onEvent,
        buildContext: options.buildContext,
      }),
    );
  } finally {
    runControllers.delete(options.runId);
  }
}

export interface StartPlanTierOptions {
  runId: string;
  projectId: string;
  tier: number;
  humanBriefing?: string;
  onEvent?: PipelineEventEmitter;
  buildContext: () => Promise<AiContext>;
}

export async function startPlanTier(
  options: StartPlanTierOptions,
): Promise<void> {
  const existing = runControllers.get(options.runId);
  if (existing) {
    throw new Error(
      `Run ${options.runId} is already in flight. Cancel it before restarting.`,
    );
  }
  const run = await getAgentRun(options.runId);
  if (!run) throw new Error(`Agent run not found: ${options.runId}`);

  const controller = new AbortController();
  runControllers.set(options.runId, controller);
  try {
    await withRunErrorCapture(
      options.runId,
      "planning",
      controller.signal,
      () =>
        planTier({
          runId: options.runId,
          projectId: options.projectId,
          tier: options.tier,
          humanBriefing: options.humanBriefing,
          signal: controller.signal,
          onEvent: options.onEvent,
          buildContext: options.buildContext,
        }),
    );
  } finally {
    runControllers.delete(options.runId);
  }
}

export interface StartExecuteTierOptions {
  runId: string;
  projectId: string;
  tier: number;
  onEvent?: PipelineEventEmitter;
  buildContext: () => Promise<AiContext>;
}

export async function startExecuteTier(
  options: StartExecuteTierOptions,
): Promise<void> {
  const existing = runControllers.get(options.runId);
  if (existing) {
    throw new Error(
      `Run ${options.runId} is already in flight. Cancel it before restarting.`,
    );
  }
  const controller = new AbortController();
  runControllers.set(options.runId, controller);
  try {
    await withRunErrorCapture(
      options.runId,
      "executing-tier",
      controller.signal,
      () =>
        executeTier({
          runId: options.runId,
          projectId: options.projectId,
          tier: options.tier,
          signal: controller.signal,
          onEvent: options.onEvent,
          buildContext: options.buildContext,
        }),
    );
  } finally {
    runControllers.delete(options.runId);
  }
}

export interface StartApplyTierOptions {
  runId: string;
  projectId: string;
  tier: number;
  approvedEditIds: string[];
  manifestName?: string;
  /** Skip the verifier pass (used for tests / no-op tiers). */
  skipVerification?: boolean;
  onEvent?: PipelineEventEmitter;
  buildContext: () => Promise<AiContext>;
}

export interface StartApplyTierResult {
  apply: ApplyTierResult;
  verify?: VerifyTierResult;
}

/**
 * Apply approved edits, then chain into the verifier so findings can become
 * new notes for the next planning round in the same controller window.
 */
export async function startApplyTier(
  options: StartApplyTierOptions,
): Promise<StartApplyTierResult> {
  const existing = runControllers.get(options.runId);
  if (existing) {
    throw new Error(
      `Run ${options.runId} is already in flight. Cancel it before restarting.`,
    );
  }
  const controller = new AbortController();
  runControllers.set(options.runId, controller);
  try {
    const apply = await withRunErrorCapture(
      options.runId,
      "applying-tier",
      controller.signal,
      () =>
        applyTier({
          runId: options.runId,
          projectId: options.projectId,
          tier: options.tier,
          approvedEditIds: options.approvedEditIds,
          manifestName: options.manifestName,
        }),
    );

    if (options.skipVerification || apply.appliedEditIds.length === 0) {
      return { apply };
    }

    const verify = await withRunErrorCapture(
      options.runId,
      "verifying-tier",
      controller.signal,
      () =>
        verifyTier({
          runId: options.runId,
          projectId: options.projectId,
          tier: options.tier,
          affectedChapterIds: apply.affectedChapterIds,
          signal: controller.signal,
          onEvent: options.onEvent,
          buildContext: options.buildContext,
        }),
    );

    return { apply, verify };
  } finally {
    runControllers.delete(options.runId);
  }
}

export interface StartRevertTierOptions {
  runId: string;
  projectId: string;
  manifestId: string;
}

export async function startRevertTier(
  options: StartRevertTierOptions,
): Promise<RevertTierResult> {
  return revertTier(options);
}

export interface StartIncrementalRereadOptions {
  runId: string;
  projectId: string;
  /** Optional override; defaults to the chapters touched by the latest tier. */
  chapterIdsInScope?: string[];
  onEvent?: PipelineEventEmitter;
  buildContext: () => Promise<AiContext>;
}

/**
 * Run a scoped Reader pass over chapters that changed since the last
 * successful Reader pass. Used to refresh the bible after the verifier
 * flagged drift.
 */
export async function startIncrementalReread(
  options: StartIncrementalRereadOptions,
): Promise<void> {
  const existing = runControllers.get(options.runId);
  if (existing) {
    throw new Error(
      `Run ${options.runId} is already in flight. Cancel it before restarting.`,
    );
  }
  const scope =
    options.chapterIdsInScope ??
    (await getChaptersAwaitingReread(options.runId));
  const controller = new AbortController();
  runControllers.set(options.runId, controller);
  try {
    await withRunErrorCapture(options.runId, "reading", controller.signal, () =>
      runReaderLoop({
        runId: options.runId,
        projectId: options.projectId,
        chapterIdsInScope: scope,
        maxPasses: 2,
        deltaThreshold: 0.05,
        signal: controller.signal,
        onEvent: options.onEvent,
        buildContext: options.buildContext,
      }),
    );
  } finally {
    runControllers.delete(options.runId);
  }
  // Clear the drift flag — next-tier planning is unblocked.
  const { updateAgentRun } = await import("@/db/operations/agentRuns");
  await updateAgentRun(options.runId, { requiresIncrementalReread: false });
}
