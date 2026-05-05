"use client";

import { type FormEvent, useState } from "react";
import { DialogFooter } from "@/components/ui/DialogFooter";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import { updateBudgetTokens } from "@/db/operations/agentRuns";
import type { AgentRun } from "@/db/schemas";

interface RaiseBudgetDialogProps {
  run: AgentRun;
  onClose: () => void;
}

const PRESETS: { label: string; delta: number }[] = [
  { label: "+500k", delta: 500_000 },
  { label: "+1M", delta: 1_000_000 },
  { label: "+5M", delta: 5_000_000 },
  { label: "+10M", delta: 10_000_000 },
];

export function RaiseBudgetDialog({ run, onClose }: RaiseBudgetDialogProps) {
  const tokenUsage =
    run.totalTokenUsage.promptTokens + run.totalTokenUsage.completionTokens;
  const usagePct = Math.min(100, (tokenUsage / run.budgetTokens) * 100);

  const [value, setValue] = useState<number>(run.budgetTokens);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isPositiveInteger = Number.isInteger(value) && value > 0;
  const isUnchanged = value === run.budgetTokens;
  const isBelowUsage = isPositiveInteger && value < tokenUsage;

  function applyPreset(delta: number) {
    setValue(run.budgetTokens + delta);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isPositiveInteger || isUnchanged) return;
    setError(null);
    setSubmitting(true);
    try {
      await updateBudgetTokens(run.id, value);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update budget");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Edit Token Budget
      </h2>

      <div className="mt-4 rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-300">
        <div className="flex items-center justify-between">
          <span>Current usage</span>
          <span className="font-mono">
            {tokenUsage.toLocaleString()} / {run.budgetTokens.toLocaleString()}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span>Percent of budget</span>
          <span className="font-mono">{usagePct.toFixed(1)}%</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <span className={LABEL_CLASS}>Quick raise</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.delta)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="raise-budget-input">
            New budget (tokens)
          </label>
          <input
            id="raise-budget-input"
            type="number"
            min={1}
            step={1}
            value={Number.isFinite(value) ? value : ""}
            onChange={(e) => {
              const next = Number.parseInt(e.target.value, 10);
              setValue(Number.isNaN(next) ? 0 : next);
            }}
            className={INPUT_CLASS}
          />
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {Number.isFinite(value) && value > 0
              ? `${value.toLocaleString()} tokens`
              : "Enter a positive integer."}
          </p>
        </div>

        {isBelowUsage && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            New budget is below current usage; the next pass will pause
            immediately.
          </p>
        )}

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        <DialogFooter
          onCancel={onClose}
          submitLabel={submitting ? "Saving…" : "Save Budget"}
          submitDisabled={!isPositiveInteger || isUnchanged || submitting}
        />
      </form>
    </Modal>
  );
}
