"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BUTTON_PRIMARY } from "@/components/ui/form-styles";
import {
  createAgentRun,
  deleteAgentRun,
  getActiveAgentRun,
  isTerminalStatus,
} from "@/db/operations/agentRuns";
import type { AgentRun } from "@/db/schemas";
import { useAgentRunsByProject } from "@/hooks/data/useAgentRun";
import { useAppSettings } from "@/hooks/data/useAppSettings";

export default function AgentsListPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const runs = useAgentRunsByProject(params.projectId);
  const settings = useAppSettings();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AgentRun | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleCreate() {
    if (!settings) return;
    setError(null);
    setCreating(true);
    try {
      const active = await getActiveAgentRun(params.projectId);
      if (active) {
        router.push(`/projects/${params.projectId}/agents/${active.id}`);
        return;
      }
      const run = await createAgentRun({
        projectId: params.projectId,
        name: `Run ${new Date().toLocaleString()}`,
        modelOverrides: settings.agentModelOverrides,
      });
      router.push(`/projects/${params.projectId}/agents/${run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create run");
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteAgentRun(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete run",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-200 px-8 py-4 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              Agent Runs
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Multi-pass manuscript reads, planning, and edits driven by the
              Reader → Orchestrator → Editor → Verifier pipeline.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !settings?.enableAiFeatures}
            className={BUTTON_PRIMARY}
          >
            {creating ? "Creating…" : "New Run"}
          </button>
        </div>
        {!settings?.enableAiFeatures && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Enable AI features in App Settings to start a run.
          </p>
        )}
        {error && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        {deleteError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            {deleteError}
          </p>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {runs && runs.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No runs yet. Click "New Run" to start your first pipeline run.
          </p>
        )}
        {runs && runs.length > 0 && (
          <ul className="space-y-2">
            {runs.map((run) => {
              const canDelete = isTerminalStatus(run.status);
              return (
                <li
                  key={run.id}
                  className="group relative rounded-md border border-neutral-200 bg-white transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                >
                  <Link
                    href={`/projects/${params.projectId}/agents/${run.id}`}
                    className="block px-4 py-3 pr-12"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">
                        {run.name}
                      </span>
                      <span className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        {run.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      Tier {run.currentTier} · {run.readerPasses.length} reader
                      pass{run.readerPasses.length === 1 ? "" : "es"} · Created{" "}
                      {new Date(run.createdAt).toLocaleString()}
                    </div>
                  </Link>
                  {canDelete && (
                    <button
                      type="button"
                      aria-label={`Delete run ${run.name}`}
                      title="Delete run"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteError(null);
                        setPendingDelete(run);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-neutral-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 dark:text-neutral-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete agent run?"
          variant="danger"
          confirmLabel={deleting ? "Deleting…" : "Delete Run"}
          message={
            <>
              <p>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {pendingDelete.name}
                </span>{" "}
                will be removed along with its reader-bible log, notes,
                questions, work units, plans, proposed edits, verifications, and
                tier snapshot manifests.
              </p>
              <p className="mt-2">
                Chapter snapshots remain available in version history. This
                cannot be undone.
              </p>
            </>
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            if (deleting) return;
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}
