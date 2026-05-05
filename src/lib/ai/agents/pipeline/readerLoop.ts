import { countAgentNotesSince } from "@/db/operations/agentNotes";
import { countAgentQuestionsSince } from "@/db/operations/agentQuestions";
import {
  appendReaderPass,
  finishReaderPass,
  getAgentRun,
  updateAgentRun,
  updateAgentRunStatus,
} from "@/db/operations/agentRuns";
import { now } from "@/db/operations/helpers";
import { countBibleLogEntriesSince } from "@/db/operations/readerBible";
import { getAppSettings } from "@/db/operations/settings";
import type { AppSettings } from "@/db/schemas";
import { makeReaderAgent } from "../builtins/reader";
import { resolveAgentModel, runAgent } from "../runner";
import type {
  IterationEndInfo,
  RunAgentCallbacks,
  ToolCallUpdateInfo,
} from "../types";
import type { PipelineEvent, PipelineEventEmitter } from "./events";

export interface ReaderLoopOptions {
  runId: string;
  projectId: string;
  /** Subset of chapter ids; defaults to whole project. */
  chapterIdsInScope?: string[];
  /** Hard cap on passes. Default 4. */
  maxPasses?: number;
  /** Termination threshold — relative delta below which we stop. Default 0.05. */
  deltaThreshold?: number;
  signal?: AbortSignal;
  onEvent?: PipelineEventEmitter;
  /**
   * Project context (style guide etc.) for the cacheable agent prompt block.
   * The reader-bible explicitly excludes the authored bible, but the style
   * guide is still useful for voice grounding.
   */
  buildContext: () => Promise<import("../../types").AiContext>;
}

const DEFAULT_MAX_PASSES = 4;
const DEFAULT_DELTA_THRESHOLD = 0.05;

/**
 * Run the Reader iteratively across multiple passes. Termination is the
 * combination of: relative delta below threshold OR max passes reached.
 *
 * Returns the final number of passes completed.
 */
export async function runReaderLoop(
  options: ReaderLoopOptions,
): Promise<{ passesCompleted: number; reason: "delta" | "max" | "aborted" }> {
  const {
    runId,
    projectId,
    chapterIdsInScope,
    maxPasses = DEFAULT_MAX_PASSES,
    deltaThreshold = DEFAULT_DELTA_THRESHOLD,
    signal,
    onEvent,
    buildContext,
  } = options;

  await updateAgentRunStatus(runId, "reading");

  let priorTotal = 0;
  let passNumber = 0;
  let exitReason: "delta" | "max" | "aborted" = "max";

  while (passNumber < maxPasses) {
    if (signal?.aborted) {
      exitReason = "aborted";
      break;
    }
    passNumber += 1;

    const run = await getAgentRun(runId);
    if (!run) throw new Error(`Agent run not found: ${runId}`);

    // Budget check before launching another pass.
    const budgetExceeded =
      run.totalTokenUsage.promptTokens + run.totalTokenUsage.completionTokens >=
      run.budgetTokens;
    if (budgetExceeded) {
      await updateAgentRunStatus(
        runId,
        "awaiting-plan-approval",
        "Token budget exceeded; pause and raise budget to continue.",
      );
      onEvent?.({
        type: "budget-exceeded",
        runId,
        usage: run.totalTokenUsage,
        budget: run.budgetTokens,
      });
      exitReason = "aborted";
      break;
    }

    const passStartIso = now();
    await appendReaderPass(runId, {
      passNumber,
      startedAt: passStartIso,
      completedAt: null,
      newBibleEntries: 0,
      newNotes: 0,
      newQuestions: 0,
    });

    onEvent?.({ type: "reader-pass-start", runId, passNumber });

    const settings = await getAppSettings();
    const context = await buildContext();
    const agent = makeReaderAgent({
      runId,
      projectId,
      passNumber,
      chapterIdsInScope,
      previousPasses: run.readerPasses,
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

    const callbacks = makePipelineCallbacks(runId, onEvent, settings);

    await runAgent({
      agent,
      // No userInput — the agent's initialMessages carry the briefing.
      userInput: undefined,
      history: [],
      model,
      stream: settings.streamResponses,
      signal,
      ...callbacks,
    });

    if (signal?.aborted) {
      exitReason = "aborted";
      break;
    }

    // Compute deltas since the start of this pass.
    const [newBibleEntries, newNotes, newQuestions] = await Promise.all([
      countBibleLogEntriesSince(runId, passStartIso),
      countAgentNotesSince(runId, passStartIso),
      countAgentQuestionsSince(runId, passStartIso),
    ]);

    await finishReaderPass(runId, {
      newBibleEntries,
      newNotes,
      newQuestions,
    });

    onEvent?.({
      type: "reader-pass-complete",
      runId,
      passNumber,
      delta: { newBibleEntries, newNotes, newQuestions },
    });

    const totalDelta = newBibleEntries + newNotes + newQuestions;
    const relative = priorTotal === 0 ? Infinity : totalDelta / priorTotal;
    priorTotal += totalDelta;

    // Pass 1 always runs to completion regardless of delta — pass 2 onwards
    // can short-circuit when reconciliation has settled.
    if (passNumber >= 2 && relative < deltaThreshold) {
      exitReason = "delta";
      break;
    }
  }

  if (exitReason === "max") {
    await updateAgentRunStatus(runId, "awaiting-plan-approval");
  } else if (exitReason === "delta") {
    await updateAgentRunStatus(runId, "awaiting-plan-approval");
  } else if (exitReason === "aborted" && !signal?.aborted) {
    // Budget pause — leave status as awaiting-plan-approval.
  } else {
    await updateAgentRunStatus(runId, "cancelled");
  }

  return { passesCompleted: passNumber, reason: exitReason };
}

/**
 * Build the runAgent callbacks that thread token-usage updates back into the
 * agentRuns row and emit pipeline events for UI consumers.
 */
function makePipelineCallbacks(
  runId: string,
  onEvent: PipelineEventEmitter | undefined,
  settings: AppSettings,
): RunAgentCallbacks {
  const _ = settings; // reserved for future per-iteration overrides
  return {
    onIterationStart: (info) => {
      onEvent?.({ type: "agent-iteration-start", runId, info });
    },
    onIterationEnd: async (info: IterationEndInfo) => {
      // Approximate token usage by character count (1 token ≈ 4 chars). We
      // don't yet thread real usage from the adapter response; this is a
      // conservative budget proxy until we wire that through.
      const approxTokens = Math.ceil(
        (info.content.length + (info.reasoning?.length ?? 0)) / 4,
      );
      const run = await getAgentRun(runId);
      if (!run) return;
      const next = {
        promptTokens: run.totalTokenUsage.promptTokens,
        completionTokens: run.totalTokenUsage.completionTokens + approxTokens,
      };
      await updateAgentRun(runId, { totalTokenUsage: next });
      onEvent?.({ type: "agent-iteration-end", runId, info });
    },
    onToolCallsCollected: (info) => {
      onEvent?.({ type: "agent-tool-calls", runId, info });
    },
    onToolCallUpdate: (info: ToolCallUpdateInfo) => {
      onEvent?.({ type: "agent-tool-update", runId, info });
    },
    // No `approveToolCall` — pipeline tools auto-approve (writes go to
    // staging tables; the only human gates are at plan/edit approval time).
  };
}

export type { PipelineEvent };
