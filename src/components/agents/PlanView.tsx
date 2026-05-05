"use client";

import { useMemo, useState } from "react";
import { BUTTON_PRIMARY, INPUT_CLASS } from "@/components/ui/form-styles";
import { useAgentRun } from "@/hooks/data/useAgentRun";
import { useAgentRunContext } from "@/hooks/data/useAgentRunContext";
import {
  useEditPlan,
  useWorkUnitsByRun,
  useWorkUnitsByTier,
} from "@/hooks/data/usePlan";
import { createActivityEmitter } from "@/lib/ai/agents/pipeline/activityEmitter";
import {
  startExecuteTier,
  startIncrementalReread,
  startPlanTier,
} from "@/lib/ai/agents/pipeline/runEngine";
import { WorkUnitCard } from "./WorkUnitCard";

interface PlanViewProps {
  runId: string;
  projectId: string;
}

export function PlanView({ runId, projectId }: PlanViewProps) {
  const run = useAgentRun(runId);
  const plan = useEditPlan(runId);
  const allUnits = useWorkUnitsByRun(runId);

  const buildContext = useAgentRunContext(projectId);

  const targetTier = run?.currentTier ?? 1;
  // currentTier is the number of tiers ALREADY APPLIED. The next tier to plan
  // is currentTier + 1 (1-based) — but we want a sensible default for an idle
  // run that hasn't planned anything yet.
  const planningTier = Math.max(1, targetTier);

  const tierOnPlan = plan?.tiers.find((t) => t.tierNumber === planningTier);
  const tierUnits = useWorkUnitsByTier(runId, planningTier);

  const [briefing, setBriefing] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const driftBlocks = run?.requiresIncrementalReread === true;
  const canPlan =
    !driftBlocks &&
    (run?.status === "awaiting-plan-approval" ||
      run?.status === "idle" ||
      !run);
  const canApprove = !!tierOnPlan && (tierUnits?.length ?? 0) > 0;

  async function handlePlan() {
    setError(null);
    setBusy(true);
    try {
      await startPlanTier({
        runId,
        projectId,
        tier: planningTier,
        humanBriefing: briefing.trim() || undefined,
        buildContext,
        onEvent: createActivityEmitter(),
      });
      setBriefing("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to plan tier");
    } finally {
      setBusy(false);
    }
  }

  async function handleIncrementalReread() {
    setError(null);
    setBusy(true);
    try {
      await startIncrementalReread({
        runId,
        projectId,
        buildContext,
        onEvent: createActivityEmitter(),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Incremental Reader pass failed",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleApproveAndExecute() {
    setError(null);
    setBusy(true);
    try {
      await startExecuteTier({
        runId,
        projectId,
        tier: planningTier,
        buildContext,
        onEvent: createActivityEmitter(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute tier");
    } finally {
      setBusy(false);
    }
  }

  const allTiers = useMemo(() => plan?.tiers ?? [], [plan]);

  if (!run) return <div className="p-4 text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      {driftBlocks && (
        <section className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-900/20">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            ⚠ Incremental Reader pass required
          </h3>
          <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
            The verifier flagged drift between the manuscript and the reader
            bible. Re-read the changed chapters before planning the next tier.
          </p>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleIncrementalReread}
              disabled={busy}
              className={BUTTON_PRIMARY}
            >
              {busy ? "Re-reading…" : "Run Incremental Reader Pass"}
            </button>
          </div>
        </section>
      )}

      <section>
        <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Tier {planningTier}
        </h3>
        {tierOnPlan ? (
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {tierOnPlan.summary || "(No summary)"} ·{" "}
            {tierOnPlan.workUnitIds.length} work units · status:{" "}
            <span className="font-mono">{plan?.status}</span>
          </p>
        ) : (
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Not yet planned. Use the orchestrator below to generate a plan from
            the open notes.
          </p>
        )}
      </section>

      {canPlan && (
        <section className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900/50">
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Optional briefing for the orchestrator
            <textarea
              value={briefing}
              onChange={(e) => setBriefing(e.target.value)}
              placeholder='e.g. "Focus on chapters 5–8, ignore voice notes for now"'
              rows={2}
              className={`${INPUT_CLASS} mt-1`}
            />
          </label>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={handlePlan}
              disabled={busy}
              className={BUTTON_PRIMARY}
            >
              {busy ? "Planning…" : tierOnPlan ? "Re-plan Tier" : "Plan Tier"}
            </button>
          </div>
        </section>
      )}

      {tierUnits && tierUnits.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Work Units ({tierUnits.length})
            </h3>
            {canApprove && run.status === "awaiting-plan-approval" && (
              <button
                type="button"
                onClick={handleApproveAndExecute}
                disabled={busy}
                className={BUTTON_PRIMARY}
              >
                {busy ? "Starting…" : "Approve & Execute Tier"}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {tierUnits.map((u) => (
              <WorkUnitCard key={u.id} unit={u} tierUnits={tierUnits} />
            ))}
          </div>
        </section>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {allTiers.length > 1 && (
        <section className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            All Tiers
          </h3>
          <ul className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
            {allTiers.map((t) => (
              <li key={t.tierNumber}>
                <span className="font-mono">Tier {t.tierNumber}</span> —{" "}
                {t.workUnitIds.length} unit
                {t.workUnitIds.length === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
        </section>
      )}

      {allUnits && allUnits.length === 0 && !tierOnPlan && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          No work units yet.
        </p>
      )}
    </div>
  );
}
