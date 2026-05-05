"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BUTTON_PRIMARY } from "@/components/ui/form-styles";
import { updateProposedEditStatus } from "@/db/operations/proposedEdits";
import type { ProposedEdit, ProposedEditStatus } from "@/db/schemas";
import { useAgentRun } from "@/hooks/data/useAgentRun";
import { useAgentRunContext } from "@/hooks/data/useAgentRunContext";
import {
  useProposedEditsByRun,
  useWorkUnitsByTier,
} from "@/hooks/data/usePlan";
import { startApplyTier } from "@/lib/ai/agents/pipeline/runEngine";
import { EditDiffCard } from "./EditDiffCard";

interface EditApprovalPanelProps {
  runId: string;
  projectId: string;
}

const REVIEWABLE: ProposedEditStatus[] = ["pending", "approved"];

export function EditApprovalPanel({
  runId,
  projectId,
}: EditApprovalPanelProps) {
  const run = useAgentRun(runId);
  const tier = run?.currentTier ?? 1;
  const tierUnits = useWorkUnitsByTier(runId, tier);
  const allEdits = useProposedEditsByRun(runId);
  const buildContext = useAgentRunContext(projectId);

  const [confirmApply, setConfirmApply] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tierUnitIds = new Set((tierUnits ?? []).map((u) => u.id));
  const tierEdits = (allEdits ?? []).filter((e) =>
    tierUnitIds.has(e.workUnitId),
  );
  const reviewableEdits = tierEdits.filter((e) =>
    REVIEWABLE.includes(e.status),
  );

  const approvedCount = reviewableEdits.filter(
    (e) => e.status === "approved",
  ).length;
  const pendingCount = reviewableEdits.filter(
    (e) => e.status === "pending",
  ).length;

  async function handleApprove(edit: ProposedEdit) {
    setError(null);
    await updateProposedEditStatus(edit.id, "approved");
  }
  async function handleReject(edit: ProposedEdit) {
    setError(null);
    await updateProposedEditStatus(edit.id, "rejected");
  }
  async function handleApproveAllPending() {
    setError(null);
    await Promise.all(
      reviewableEdits
        .filter((e) => e.status === "pending")
        .map((e) => updateProposedEditStatus(e.id, "approved")),
    );
  }

  async function handleApply() {
    setConfirmApply(false);
    setError(null);
    setBusy(true);
    try {
      const approvedIds = reviewableEdits
        .filter((e) => e.status === "approved")
        .map((e) => e.id);
      await startApplyTier({
        runId,
        projectId,
        tier,
        approvedEditIds: approvedIds,
        buildContext,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply tier");
    } finally {
      setBusy(false);
    }
  }

  if (!run) return <div className="p-4 text-sm">Loading…</div>;

  // Group by chapter for nicer display.
  const byChapter = new Map<string, ProposedEdit[]>();
  for (const e of reviewableEdits) {
    const list = byChapter.get(e.chapterId) ?? [];
    list.push(e);
    byChapter.set(e.chapterId, list);
  }

  const canApply = run.status === "awaiting-edit-approval" && approvedCount > 0;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Tier {tier} edits
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {tierEdits.length} total · {approvedCount} approved · {pendingCount}{" "}
            pending
          </p>
        </div>
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={handleApproveAllPending}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Approve all pending
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmApply(true)}
            disabled={!canApply || busy}
            className={BUTTON_PRIMARY}
          >
            {busy ? "Applying…" : "Apply Approved Edits"}
          </button>
        </div>
      </header>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {tierEdits.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No edits proposed for tier {tier} yet. Approve the plan in the Plan
          tab to start the editors.
        </p>
      )}

      {byChapter.size > 0 && (
        <div className="space-y-4">
          {[...byChapter.entries()].map(([chapterId, edits]) => (
            <ChapterEditGroup
              key={chapterId}
              edits={edits}
              onApprove={handleApprove}
              onReject={handleReject}
              busy={busy}
            />
          ))}
        </div>
      )}

      {confirmApply && (
        <ConfirmDialog
          title="Apply approved edits to the manuscript?"
          message={`A snapshot will be created. ${approvedCount} edit${
            approvedCount === 1 ? "" : "s"
          } across ${byChapter.size} chapter${
            byChapter.size === 1 ? "" : "s"
          } will be applied. Pending edits will be rejected. The verifier will then re-read the affected chapters and surface any drift as new notes for the next planning round.`}
          variant="default"
          confirmLabel="Apply Edits"
          onConfirm={handleApply}
          onCancel={() => setConfirmApply(false)}
        />
      )}
    </div>
  );
}

function ChapterEditGroup({
  edits,
  onApprove,
  onReject,
  busy,
}: {
  edits: ProposedEdit[];
  onApprove: (edit: ProposedEdit) => void;
  onReject: (edit: ProposedEdit) => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-2">
      {edits.map((e) => (
        <EditDiffCard
          key={e.id}
          edit={e}
          onApprove={() => onApprove(e)}
          onReject={() => onReject(e)}
          busy={busy}
        />
      ))}
    </div>
  );
}
