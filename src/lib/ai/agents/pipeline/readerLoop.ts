import { countAgentNotesSince } from "@/db/operations/agentNotes";
import {
  countAgentQuestionsOpen,
  countAgentQuestionsSince,
} from "@/db/operations/agentQuestions";
import {
  appendReaderPass,
  finishReaderPass,
  getAgentRun,
  patchActiveReaderPass,
  updateAgentRunStatus,
} from "@/db/operations/agentRuns";
import { getChaptersByProject } from "@/db/operations/chapters";
import { now } from "@/db/operations/helpers";
import { countBibleLogEntriesSince } from "@/db/operations/readerBible";
import { getAppSettings } from "@/db/operations/settings";
import type { AgentRun, Chapter, ReaderMode } from "@/db/schemas";
import type { AiMessage } from "../../types";
import {
  buildComprehensionBriefing,
  makeReaderAgent,
} from "../builtins/reader";
import { invokeAgentForRun } from "../runner";
import type { PipelineEvent, PipelineEventEmitter } from "./events";

/**
 * Status reason written to the agent run when the cumulative token usage
 * reaches `budgetTokens`. Exported so the dashboard UI can detect this
 * specific paused state and surface a "Raise Budget" affordance — keep
 * the literal in one place to avoid drift.
 */
export const BUDGET_EXCEEDED_REASON =
  "Token budget exceeded; pause and raise budget to continue.";

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

const DEFAULT_MAX_PASSES = 12;
const DEFAULT_DELTA_THRESHOLD = 0.05;

/**
 * Run the Reader across a state-driven sequence of passes:
 *
 *   comprehension (one or more passes)
 *     Forward-only chapter walk. A single pass accumulates conversation
 *     history across consecutive chapters so the agent can directly
 *     reference prior chapter text. When the per-iteration prompt-token
 *     count exceeds `comprehensionContextThreshold`, the pass ends mid-walk
 *     and the outer loop schedules another comprehension pass starting at
 *     the next chapter ("soft reset"). The reader bible carries forward.
 *
 *   thematic (one pass)
 *     Single whole-work invocation; motifs/symbols/subtext.
 *
 *   self-answer (one or more passes)
 *     Single whole-work invocation; resolves open questions. Loops until
 *     relative delta falls below threshold or no questions remain.
 *
 * Returns the number of passes completed and the reason for stopping.
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

  // Resolve the chapter set once up front so `pickNextMode` can decide when
  // comprehension is fully covered. Chapter reorders mid-run will not be
  // reflected — accept that since runs are short.
  const allChapters = await getChaptersByProject(projectId);
  const chaptersInScope = filterChapters(allChapters, chapterIdsInScope);

  // Seed `passNumber` from the existing run so labels stay globally unique
  // across re-entries (subsequent "Run Another Reader Pass" clicks and
  // retries). `passesThisInvocation` is the loop-bound counter so `maxPasses`
  // remains a per-invocation cap, not a per-run total.
  const initialRun = await getAgentRun(runId);
  if (!initialRun) throw new Error(`Agent run not found: ${runId}`);
  let passNumber = initialRun.readerPasses.reduce(
    (max, p) => Math.max(max, p.passNumber),
    0,
  );
  let passesThisInvocation = 0;
  let priorTotal = 0;
  let exitReason: "delta" | "max" | "aborted" = "max";

  while (passesThisInvocation < maxPasses) {
    if (signal?.aborted) {
      exitReason = "aborted";
      break;
    }

    const budgetCheck = await checkBudget(runId, onEvent);
    if (budgetCheck === "exceeded") {
      exitReason = "aborted";
      break;
    }

    const run = await getAgentRun(runId);
    if (!run) throw new Error(`Agent run not found: ${runId}`);

    const next = pickNextMode(run, chaptersInScope);
    if (next === null) {
      // All modes exhausted — comprehension + thematic done, no questions.
      exitReason = "delta";
      break;
    }

    passNumber += 1;
    passesThisInvocation += 1;
    const { mode, startFromOrder } = next;
    const passStartIso = now();
    await appendReaderPass(runId, {
      passNumber,
      mode,
      startedAt: passStartIso,
      completedAt: null,
      newBibleEntries: 0,
      newNotes: 0,
      newQuestions: 0,
      // Filled in by `patchActiveReaderPass` after each comprehension
      // chapter completes; remains null for thematic / self-answer.
      firstChapterOrder: null,
      lastChapterOrder: null,
    });

    onEvent?.({ type: "reader-pass-start", runId, passNumber, mode });

    let passResult: PassOutcome;
    switch (mode) {
      case "comprehension":
        passResult = await runComprehensionPass(
          runId,
          projectId,
          passNumber,
          chaptersInScope,
          startFromOrder ?? 0,
          signal,
          onEvent,
          buildContext,
        );
        break;
      case "thematic":
        passResult = await runThematicPass(
          runId,
          projectId,
          passNumber,
          chapterIdsInScope,
          signal,
          onEvent,
          buildContext,
        );
        break;
      case "self-answer":
        passResult = await runSelfAnswerPass(
          runId,
          projectId,
          passNumber,
          chapterIdsInScope,
          signal,
          onEvent,
          buildContext,
        );
        break;
    }

    if (passResult === "aborted") {
      exitReason = "aborted";
      break;
    }
    if (passResult === "budget-exceeded") {
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
      mode,
      delta: { newBibleEntries, newNotes, newQuestions },
    });

    const totalDelta = newBibleEntries + newNotes + newQuestions;
    const relative = priorTotal === 0 ? Infinity : totalDelta / priorTotal;
    priorTotal += totalDelta;

    // Thematic always runs to completion. Comprehension may end mid-walk
    // (soft reset) and the outer loop will schedule another comprehension
    // pass via pickNextMode. Self-answer is the only mode that can
    // short-circuit the whole loop, and it additionally stops when there
    // are no remaining open questions.
    if (mode === "self-answer") {
      if (relative < deltaThreshold) {
        exitReason = "delta";
        break;
      }
      const remaining = await countAgentQuestionsOpen(runId);
      if (remaining === 0) {
        exitReason = "delta";
        break;
      }
    }
  }

  if (exitReason === "max" || exitReason === "delta") {
    await updateAgentRunStatus(runId, "awaiting-plan-approval");
  } else if (exitReason === "aborted" && !signal?.aborted) {
    // Budget pause — leave status as awaiting-plan-approval.
  } else {
    await updateAgentRunStatus(runId, "cancelled");
  }

  return { passesCompleted: passesThisInvocation, reason: exitReason };
}

/**
 * State-driven pass dispatcher. Returns the next mode the loop should run,
 * along with `startFromOrder` for comprehension resumption. Returns `null`
 * when there is nothing left to do.
 *
 *   - If any chapter has not yet been covered by a comprehension pass →
 *     comprehension, starting at the first uncovered chapter.
 *   - Else if no thematic pass has run → thematic.
 *   - Else if open questions remain → self-answer.
 *   - Else → null.
 */
function pickNextMode(
  run: AgentRun,
  chaptersInScope: Chapter[],
): { mode: ReaderMode; startFromOrder?: number } | null {
  const comprehensionPasses = run.readerPasses.filter(
    (p) => p.mode === "comprehension",
  );
  const lastComprehensionEnd = comprehensionPasses.reduce<number | null>(
    (acc, p) =>
      p.lastChapterOrder === null
        ? acc
        : acc === null
          ? p.lastChapterOrder
          : Math.max(acc, p.lastChapterOrder),
    null,
  );
  const lastChapterOrderInScope =
    chaptersInScope.length > 0
      ? Math.max(...chaptersInScope.map((c) => c.order))
      : -1;

  const allComprehensionDone =
    chaptersInScope.length === 0 ||
    (lastComprehensionEnd !== null &&
      lastComprehensionEnd >= lastChapterOrderInScope);

  if (!allComprehensionDone) {
    const startFromOrder =
      lastComprehensionEnd === null ? 0 : lastComprehensionEnd + 1;
    return { mode: "comprehension", startFromOrder };
  }

  const hasThematic = run.readerPasses.some((p) => p.mode === "thematic");
  if (!hasThematic) return { mode: "thematic" };

  return { mode: "self-answer" };
}

type PassOutcome = "completed" | "aborted" | "budget-exceeded";

/**
 * Comprehension pass (one segment): walk chapters in canonical order
 * starting at `startFromOrder`, threading conversation history across
 * chapters in a single accumulating segment. The per-chapter briefing is
 * pushed into segmentHistory as a user message so the model sees prior
 * chapter content directly when reading the current one. After each
 * chapter, if `lastIterationPromptTokens` exceeds the configured threshold,
 * the segment ends — the outer loop will schedule a new comprehension pass
 * starting at the next chapter (soft reset). The reader bible is the
 * persistent memory across segments.
 */
async function runComprehensionPass(
  runId: string,
  projectId: string,
  passNumber: number,
  chaptersInScope: Chapter[],
  startFromOrder: number,
  signal: AbortSignal | undefined,
  onEvent: PipelineEventEmitter | undefined,
  buildContext: () => Promise<import("../../types").AiContext>,
): Promise<PassOutcome> {
  const segmentChapters = chaptersInScope.filter(
    (c) => c.order >= startFromOrder,
  );
  if (segmentChapters.length === 0) return "completed";

  const totalChapters = chaptersInScope.length;
  let segmentHistory: AiMessage[] = [];
  let firstChapterInSegmentRecorded = false;
  // Threshold doesn't change mid-pass; fetch once and reuse for the soft-reset
  // check. Model resolution / stream flag come from a fresh fetch inside
  // invokeAgentForRun on every chapter (cheap IDB read).
  const settings = await getAppSettings();

  for (let i = 0; i < segmentChapters.length; i++) {
    if (signal?.aborted) return "aborted";

    // Re-check budget between chapters so a long pass can pause cleanly
    // rather than blow past the configured token budget.
    const budgetCheck = await checkBudget(runId, onEvent);
    if (budgetCheck === "exceeded") return "budget-exceeded";

    const chapter = segmentChapters[i];
    // chapterIndex is the chapter's 1-based position in the full scope, not
    // within this segment, so the agent sees a stable chapter number across
    // soft resets.
    const chapterIndex =
      chaptersInScope.findIndex((c) => c.id === chapter.id) + 1;

    onEvent?.({
      type: "reader-chapter-start",
      runId,
      passNumber,
      chapterId: chapter.id,
      chapterIndex,
      totalChapters,
    });

    const chapterStartIso = now();
    const context = await buildContext();
    const agent = makeReaderAgent({
      runId,
      projectId,
      passNumber,
      mode: "comprehension",
      chapter,
      chapterIndex,
      totalChapters,
      context,
    });

    const briefing = buildComprehensionBriefing({
      chapter,
      chapterIndex,
      totalChapters,
      segmentPosition: i === 0 ? "first" : "continuing",
    });
    // Append the briefing as a user message into the segment history so it
    // persists across runAgent iterations *and* across chapters within this
    // segment. (runAgent's `userInput` parameter only flows on iteration 1.)
    segmentHistory = [...segmentHistory, { role: "user", content: briefing }];

    const result = await invokeAgentForRun({
      runId,
      agent,
      history: segmentHistory,
      signal,
      onEvent,
    });

    if (signal?.aborted || result.aborted) return "aborted";

    segmentHistory = result.history;

    // Patch the in-flight pass row with cumulative coverage so the UI sees
    // progress chapter-by-chapter inside a long segment.
    if (!firstChapterInSegmentRecorded) {
      await patchActiveReaderPass(runId, {
        firstChapterOrder: chapter.order,
        lastChapterOrder: chapter.order,
      });
      firstChapterInSegmentRecorded = true;
    } else {
      await patchActiveReaderPass(runId, { lastChapterOrder: chapter.order });
    }

    const [newBibleEntries, newNotes, newQuestions] = await Promise.all([
      countBibleLogEntriesSince(runId, chapterStartIso),
      countAgentNotesSince(runId, chapterStartIso),
      countAgentQuestionsSince(runId, chapterStartIso),
    ]);

    onEvent?.({
      type: "reader-chapter-complete",
      runId,
      passNumber,
      chapterId: chapter.id,
      chapterIndex,
      totalChapters,
      delta: { newBibleEntries, newNotes, newQuestions },
    });

    // Soft-reset trigger: if this iteration's prompt size crossed the
    // configured threshold, end the segment after this chapter. The outer
    // loop will schedule another comprehension pass starting at the next
    // chapter with empty history. Reader bible carries forward.
    const postRun = await getAgentRun(runId);
    if (
      postRun &&
      postRun.lastIterationPromptTokens >
        settings.comprehensionContextThreshold &&
      i < segmentChapters.length - 1
    ) {
      return "completed";
    }
  }

  return "completed";
}

async function runThematicPass(
  runId: string,
  projectId: string,
  passNumber: number,
  chapterIdsInScope: string[] | undefined,
  signal: AbortSignal | undefined,
  onEvent: PipelineEventEmitter | undefined,
  buildContext: () => Promise<import("../../types").AiContext>,
): Promise<PassOutcome> {
  const context = await buildContext();
  const agent = makeReaderAgent({
    runId,
    projectId,
    passNumber,
    mode: "thematic",
    chapterIdsInScope,
    context,
  });

  await invokeAgentForRun({ runId, agent, signal, onEvent });

  if (signal?.aborted) return "aborted";
  return "completed";
}

async function runSelfAnswerPass(
  runId: string,
  projectId: string,
  passNumber: number,
  chapterIdsInScope: string[] | undefined,
  signal: AbortSignal | undefined,
  onEvent: PipelineEventEmitter | undefined,
  buildContext: () => Promise<import("../../types").AiContext>,
): Promise<PassOutcome> {
  // Skip self-answer entirely when there are no questions to resolve. This
  // keeps the loop cheap on projects that don't accumulate questions.
  const remaining = await countAgentQuestionsOpen(runId);
  if (remaining === 0) return "completed";

  const context = await buildContext();
  const agent = makeReaderAgent({
    runId,
    projectId,
    passNumber,
    mode: "self-answer",
    chapterIdsInScope,
    context,
  });

  await invokeAgentForRun({ runId, agent, signal, onEvent });

  if (signal?.aborted) return "aborted";
  return "completed";
}

function filterChapters(
  all: Chapter[],
  chapterIdsInScope: string[] | undefined,
): Chapter[] {
  if (!chapterIdsInScope || chapterIdsInScope.length === 0) return all;
  const inScope = new Set(chapterIdsInScope);
  return all.filter((c) => inScope.has(c.id));
}

async function checkBudget(
  runId: string,
  onEvent: PipelineEventEmitter | undefined,
): Promise<"ok" | "exceeded"> {
  const run = await getAgentRun(runId);
  if (!run) throw new Error(`Agent run not found: ${runId}`);
  const used =
    run.totalTokenUsage.promptTokens + run.totalTokenUsage.completionTokens;
  if (used < run.budgetTokens) return "ok";

  await updateAgentRunStatus(
    runId,
    "awaiting-plan-approval",
    BUDGET_EXCEEDED_REASON,
  );
  onEvent?.({
    type: "budget-exceeded",
    runId,
    usage: run.totalTokenUsage,
    budget: run.budgetTokens,
  });
  return "exceeded";
}

export type { PipelineEvent };
