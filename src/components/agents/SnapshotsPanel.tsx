"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BUTTON_DANGER } from "@/components/ui/form-styles";
import type { AgentRunId, ProjectId, SnapshotManifest } from "@/db/schemas";
import { useSnapshotManifests } from "@/hooks/data/useVerifications";
import { startRevertTier } from "@/lib/ai/agents/pipeline";

interface SnapshotsPanelProps {
  runId: AgentRunId;
  projectId: ProjectId;
}

export function SnapshotsPanel({ runId, projectId }: SnapshotsPanelProps) {
  const manifests = useSnapshotManifests(runId);
  const [confirm, setConfirm] = useState<SnapshotManifest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRevert(manifest: SnapshotManifest) {
    setError(null);
    setBusy(true);
    try {
      await startRevertTier({
        runId,
        projectId,
        manifestId: manifest.id,
      });
      setConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revert failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <header>
        <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Snapshot Manifests
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          One manifest is created at the moment each tier is applied. Reverting
          to a manifest restores chapters to their pre-apply state and discards
          all downstream tiers.
        </p>
      </header>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {(!manifests || manifests.length === 0) && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No manifests yet — apply a tier to create one.
        </p>
      )}

      <ul className="space-y-2">
        {manifests?.map((m) => (
          <li
            key={m.id}
            className="rounded-md border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-neutral-900 dark:text-neutral-100">
                  {m.name}
                </div>
                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Tier {m.tierNumber} · {m.chapterSnapshotIds.length} chapter
                  snapshot
                  {m.chapterSnapshotIds.length === 1 ? "" : "s"} ·{" "}
                  {new Date(m.createdAt).toLocaleString()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirm(m)}
                disabled={busy}
                className={BUTTON_DANGER}
              >
                Revert here
              </button>
            </div>
          </li>
        ))}
      </ul>

      {confirm && (
        <ConfirmDialog
          title={`Revert to "${confirm.name}"?`}
          message={
            <>
              <p>
                Chapters will be restored from this manifest's snapshots.{" "}
                {
                  (manifests ?? []).filter(
                    (m) => m.createdAt > confirm.createdAt,
                  ).length
                }{" "}
                downstream manifest(s), their work units, proposed edits, and
                verifications will be discarded.
              </p>
              <p className="mt-2">
                Reader bible / notes from before this tier remain valid. The
                next plan will need to be re-derived.
              </p>
            </>
          }
          variant="danger"
          confirmLabel="Revert"
          cancelLabel={busy ? "Working…" : "Cancel"}
          onConfirm={() => handleRevert(confirm)}
          onCancel={() => !busy && setConfirm(null)}
        />
      )}
    </div>
  );
}
