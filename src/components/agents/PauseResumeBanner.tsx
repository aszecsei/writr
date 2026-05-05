"use client";

import { useState } from "react";
import { BUTTON_CANCEL, BUTTON_PRIMARY } from "@/components/ui/form-styles";
import {
  isTerminalStatus,
  updateAgentRunStatus,
} from "@/db/operations/agentRuns";
import type { AgentRun, AgentRunStatus } from "@/db/schemas";
import { useAgentRunContext } from "@/hooks/data/useAgentRunContext";
import {
  getRunController,
  startExecuteTier,
  startPlanTier,
  startReaderPhase,
} from "@/lib/ai/agents/pipeline/runEngine";

interface PauseResumeBannerProps {
  run: AgentRun;
  projectId: string;
}

/** Statuses that can mean "in flight" — i.e. an agent loop is supposed to be
 * running. If we see one of these but no module-level controller exists, the
 * run was stranded by a prior page reload or tab close. */
const ACTIVE_STATUSES: AgentRunStatus[] = [
  "reading",
  "planning",
  "executing-tier",
  "applying-tier",
  "verifying-tier",
];

const STATUS_LABEL: Partial<Record<AgentRunStatus, string>> = {
  reading: "Reader pass",
  planning: "Orchestrator (planning)",
  "executing-tier": "Editor agents (executing tier)",
  "applying-tier": "Applying tier to manuscript",
  "verifying-tier": "Verifier",
};

/**
 * Detects mid-flight runs that lost their controller (page reload, tab close,
 * crash) and offers the user a choice between resuming or marking the run
 * cancelled. Auto-resume is intentionally opt-in — re-running an agent costs
 * tokens, so the user always confirms.
 */
export function PauseResumeBanner({ run, projectId }: PauseResumeBannerProps) {
  const buildContext = useAgentRunContext(projectId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInFlight = !!getRunController(run.id);
  const isStranded =
    !isInFlight &&
    !isTerminalStatus(run.status) &&
    ACTIVE_STATUSES.includes(run.status);

  if (!isStranded) return null;

  async function handleResume() {
    setError(null);
    setBusy(true);
    try {
      switch (run.status) {
        case "reading":
          await startReaderPhase({ runId: run.id, projectId, buildContext });
          break;
        case "planning":
          await startPlanTier({
            runId: run.id,
            projectId,
            tier: Math.max(1, run.currentTier),
            buildContext,
          });
          break;
        case "executing-tier":
          await startExecuteTier({
            runId: run.id,
            projectId,
            tier: Math.max(1, run.currentTier),
            buildContext,
          });
          break;
        case "applying-tier":
        case "verifying-tier":
          // Apply/verify aren't safely resumable — mark cancelled and ask
          // the user to revert via the Snapshots tab if needed.
          await updateAgentRunStatus(
            run.id,
            "error",
            `Interrupted during ${run.status}. Review chapters and consider reverting from the Snapshots tab.`,
          );
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resume");
    } finally {
      setBusy(false);
    }
  }

  async function handleDiscard() {
    setError(null);
    setBusy(true);
    try {
      await updateAgentRunStatus(
        run.id,
        "cancelled",
        "Cancelled after detecting a stranded run on reload.",
      );
    } finally {
      setBusy(false);
    }
  }

  const phase = STATUS_LABEL[run.status] ?? run.status;
  const fragile =
    run.status === "applying-tier" || run.status === "verifying-tier";

  return (
    <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800/40 dark:bg-amber-900/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-amber-900 dark:text-amber-200">
            ⚠ Stranded run detected
          </h3>
          <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
            This run was in <span className="font-mono">{phase}</span> but no
            controller is active in this tab — a previous session was likely
            interrupted. Resume to re-run the phase from the persisted state, or
            discard to mark the run cancelled.
            {fragile && (
              <span className="mt-1 block">
                Note: {run.status === "applying-tier" ? "apply" : "verify"} is
                not safely resumable. The action below will mark the run as
                errored so you can decide whether to revert from the Snapshots
                tab.
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={busy}
            className={BUTTON_CANCEL}
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleResume}
            disabled={busy}
            className={BUTTON_PRIMARY}
          >
            {busy ? "Working…" : fragile ? "Mark Errored" : `Resume ${phase}`}
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
