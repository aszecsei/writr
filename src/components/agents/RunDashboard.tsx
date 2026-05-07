"use client";

import { useState } from "react";
import { BUTTON_CANCEL, BUTTON_PRIMARY } from "@/components/ui/form-styles";
import {
  isTerminalStatus,
  updateAgentRunStatus,
} from "@/db/operations/agentRuns";
import type { AgentRunId, ProjectId } from "@/db/schemas";
import { useAgentRun } from "@/hooks/data/useAgentRun";
import { useAgentRunContext } from "@/hooks/data/useAgentRunContext";
import {
  BUDGET_EXCEEDED_REASON,
  cancelRun,
  createActivityEmitter,
  getRunController,
  isRetryablePhase,
  PHASE_STATUS_LABEL,
  startExecuteTier,
  startPlanTier,
  startReaderPhase,
} from "@/lib/ai/agents/pipeline";
import { ActivityPanel } from "./ActivityPanel";
import { EditApprovalPanel } from "./EditApprovalPanel";
import { NotesQuestionsPanel } from "./NotesQuestionsPanel";
import { PauseResumeBanner } from "./PauseResumeBanner";
import { PlanView } from "./PlanView";
import { RaiseBudgetDialog } from "./RaiseBudgetDialog";
import { ReaderBibleView } from "./ReaderBibleView";
import { SnapshotsPanel } from "./SnapshotsPanel";
import { VerificationPanel } from "./VerificationPanel";

interface RunDashboardProps {
  runId: AgentRunId;
  projectId: ProjectId;
}

type Tab =
  | "overview"
  | "activity"
  | "bible"
  | "notes"
  | "plan"
  | "edits"
  | "verification"
  | "snapshots";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
  { id: "bible", label: "Reader Bible" },
  { id: "notes", label: "Notes & Questions" },
  { id: "plan", label: "Plan" },
  { id: "edits", label: "Edits" },
  { id: "verification", label: "Verification" },
  { id: "snapshots", label: "Snapshots" },
];

export function RunDashboard({ runId, projectId }: RunDashboardProps) {
  const run = useAgentRun(runId);
  const [tab, setTab] = useState<Tab>("overview");
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);

  const buildContext = useAgentRunContext(projectId);

  const isInFlight = !!getRunController(runId);

  async function handleStartReader() {
    setActionError(null);
    try {
      await startReaderPhase({
        runId,
        projectId,
        buildContext,
        onEvent: createActivityEmitter(),
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to start");
    }
  }

  async function handleCancel() {
    cancelRun(runId);
    await updateAgentRunStatus(runId, "cancelled", "Cancelled by user");
  }

  async function handleRetry() {
    if (!run || !run.failedFromStatus) return;
    const phase = run.failedFromStatus;
    setActionError(null);
    // Restore the run to the phase that errored. updateAgentRunStatus clears
    // failedFromStatus on any non-error transition so the Retry button hides
    // immediately and the entry point's error-capture wrapper has a clean
    // slate to write into if this attempt also fails.
    await updateAgentRunStatus(runId, phase, null);
    try {
      switch (phase) {
        case "reading":
          await startReaderPhase({
            runId,
            projectId,
            buildContext,
            onEvent: createActivityEmitter(),
          });
          break;
        case "planning":
          await startPlanTier({
            runId,
            projectId,
            tier: Math.max(1, run.currentTier),
            buildContext,
          });
          break;
        case "executing-tier":
          await startExecuteTier({
            runId,
            projectId,
            tier: Math.max(1, run.currentTier),
            buildContext,
          });
          break;
        // applying-tier / verifying-tier are not safely resumable; the
        // Retry button is hidden for those phases (see render gate below).
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to retry");
    }
  }

  if (!run) return <div className="p-6 text-sm">Loading run…</div>;

  const tokenUsage =
    run.totalTokenUsage.promptTokens + run.totalTokenUsage.completionTokens;
  const budgetPct = Math.min(100, (tokenUsage / run.budgetTokens) * 100);
  const isBudgetExceeded = run.statusReason === BUDGET_EXCEEDED_REASON;
  const canEditBudget = !isTerminalStatus(run.status);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-200 px-8 py-4 dark:border-neutral-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {run.name}
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Status: <span className="font-mono text-xs">{run.status}</span> ·
              Tier {run.currentTier} · {run.readerPasses.length} reader pass
              {run.readerPasses.length === 1 ? "" : "es"}
            </p>
            {run.statusReason && (
              <p
                className={
                  run.status === "error"
                    ? "mt-1 text-xs text-red-600 dark:text-red-400"
                    : "mt-1 text-xs text-amber-600 dark:text-amber-400"
                }
              >
                {run.statusReason}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {isBudgetExceeded && !isInFlight && (
              <button
                type="button"
                onClick={() => setEditingBudget(true)}
                className={BUTTON_PRIMARY}
              >
                Raise Budget
              </button>
            )}
            {run.status === "error" &&
              isRetryablePhase(run.failedFromStatus) &&
              !isInFlight && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className={BUTTON_PRIMARY}
                >
                  Retry{" "}
                  {run.failedFromStatus
                    ? (PHASE_STATUS_LABEL[run.failedFromStatus] ??
                      run.failedFromStatus)
                    : ""}
                </button>
              )}
            {(run.status === "idle" ||
              run.status === "awaiting-plan-approval") &&
              !isInFlight && (
                <button
                  type="button"
                  onClick={handleStartReader}
                  className={BUTTON_PRIMARY}
                >
                  {run.readerPasses.length === 0
                    ? "Start Reader Phase"
                    : "Run Another Reader Pass"}
                </button>
              )}
            {(isInFlight || run.status === "reading") && (
              <button
                type="button"
                onClick={handleCancel}
                className={BUTTON_CANCEL}
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>
              Tokens: {tokenUsage.toLocaleString()} /{" "}
              {run.budgetTokens.toLocaleString()}
              {canEditBudget && (
                <button
                  type="button"
                  onClick={() => setEditingBudget(true)}
                  className="ml-2 text-primary-600 hover:underline dark:text-primary-400"
                >
                  Edit
                </button>
              )}
            </span>
            <span>{budgetPct.toFixed(1)}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-neutral-200 dark:bg-neutral-700">
            <div
              className={`h-full transition-all ${
                budgetPct > 80 ? "bg-red-500" : "bg-primary-500"
              }`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          {run.lastIterationPromptTokens > 0 && (
            <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              Context: {run.lastIterationPromptTokens.toLocaleString()} tokens
              <span className="ml-1 text-neutral-400 dark:text-neutral-500">
                (last iteration)
              </span>
            </div>
          )}
          {(run.totalTokenUsage.cacheReadTokens > 0 ||
            run.totalTokenUsage.cacheCreationTokens > 0) && (
            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Cache: {run.totalTokenUsage.cacheReadTokens.toLocaleString()} read
              · {run.totalTokenUsage.cacheCreationTokens.toLocaleString()}{" "}
              written
            </div>
          )}
        </div>

        {actionError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            {actionError}
          </p>
        )}

        <PauseResumeBanner run={run} projectId={projectId} />

        <div className="mt-4 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded px-3 py-1 text-sm ${
                tab === t.id
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {tab === "overview" && (
          <div className="space-y-4">
            <section>
              <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Reader Passes
              </h3>
              {run.readerPasses.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                  No passes yet. Start the Reader Phase to populate the bible
                  and notes.
                </p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {run.readerPasses.map((p) => {
                    const showRange =
                      p.mode === "comprehension" &&
                      p.firstChapterOrder !== null &&
                      p.lastChapterOrder !== null &&
                      p.lastChapterOrder >= p.firstChapterOrder;
                    return (
                      <li
                        key={p.passNumber}
                        className="rounded bg-neutral-50 px-3 py-2 dark:bg-neutral-900/50"
                      >
                        <span className="font-medium">Pass {p.passNumber}</span>{" "}
                        <span className="text-neutral-500 dark:text-neutral-400">
                          ({p.mode}
                          {showRange
                            ? ` · ch ${(p.firstChapterOrder as number) + 1}-${(p.lastChapterOrder as number) + 1}`
                            : ""}
                          )
                        </span>{" "}
                        ·{" "}
                        <span className="text-neutral-500 dark:text-neutral-400">
                          {p.completedAt
                            ? `+${p.newBibleEntries} bible · +${p.newNotes} notes · +${p.newQuestions} questions`
                            : "in progress…"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
        {tab === "activity" && <ActivityPanel runId={runId} />}
        {tab === "bible" && <ReaderBibleView runId={runId} />}
        {tab === "notes" && <NotesQuestionsPanel runId={runId} />}
        {tab === "plan" && <PlanView runId={runId} projectId={projectId} />}
        {tab === "edits" && (
          <EditApprovalPanel runId={runId} projectId={projectId} />
        )}
        {tab === "verification" && <VerificationPanel runId={runId} />}
        {tab === "snapshots" && (
          <SnapshotsPanel runId={runId} projectId={projectId} />
        )}
      </div>

      {editingBudget && (
        <RaiseBudgetDialog run={run} onClose={() => setEditingBudget(false)} />
      )}
    </div>
  );
}
