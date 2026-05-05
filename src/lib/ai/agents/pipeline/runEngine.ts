import { getAgentRun } from "@/db/operations/agentRuns";
import type { AiContext } from "../../types";
import type { PipelineEventEmitter } from "./events";
import { runReaderLoop } from "./readerLoop";

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
    await runReaderLoop({
      runId: options.runId,
      projectId: options.projectId,
      chapterIdsInScope: options.chapterIdsInScope,
      maxPasses: options.maxPasses,
      deltaThreshold: options.deltaThreshold,
      signal: controller.signal,
      onEvent: options.onEvent,
      buildContext: options.buildContext,
    });
  } finally {
    runControllers.delete(options.runId);
  }
}
