"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { BUTTON_PRIMARY } from "@/components/ui/form-styles";
import { createAgentRun, getActiveAgentRun } from "@/db/operations/agentRuns";
import { useAgentRunsByProject } from "@/hooks/data/useAgentRun";
import { useAppSettings } from "@/hooks/data/useAppSettings";

export default function AgentsListPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const runs = useAgentRunsByProject(params.projectId);
  const settings = useAppSettings();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {runs && runs.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No runs yet. Click "New Run" to start your first pipeline run.
          </p>
        )}
        {runs && runs.length > 0 && (
          <ul className="space-y-2">
            {runs.map((run) => (
              <li key={run.id}>
                <Link
                  href={`/projects/${params.projectId}/agents/${run.id}`}
                  className="block rounded-md border border-neutral-200 bg-white px-4 py-3 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
