"use client";

import { useCallback, useState } from "react";
import { BUTTON_CANCEL, BUTTON_PRIMARY } from "@/components/ui/form-styles";
import { updateAgentRunStatus } from "@/db/operations/agentRuns";
import { useAgentRun } from "@/hooks/data/useAgentRun";
import {
  useCharactersByProject,
  useLocationsByProject,
  useRelationshipsByProject,
  useStyleGuideByProject,
  useTimelineByProject,
  useWorldbuildingDocsByProject,
} from "@/hooks/data/useBibleEntries";
import { useChaptersByProject } from "@/hooks/data/useChapter";
import { useProject } from "@/hooks/data/useProject";
import {
  useOutlineGridCells,
  useOutlineGridColumns,
  useOutlineGridRows,
} from "@/hooks/outline/useOutlineGrid";
import {
  cancelRun,
  getRunController,
  startReaderPhase,
} from "@/lib/ai/agents/pipeline/runEngine";
import type { AiContext } from "@/lib/ai/types";
import { NotesQuestionsPanel } from "./NotesQuestionsPanel";
import { ReaderBibleView } from "./ReaderBibleView";

interface RunDashboardProps {
  runId: string;
  projectId: string;
}

type Tab = "overview" | "bible" | "notes";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "bible", label: "Reader Bible" },
  { id: "notes", label: "Notes & Questions" },
];

export function RunDashboard({ runId, projectId }: RunDashboardProps) {
  const run = useAgentRun(runId);
  const [tab, setTab] = useState<Tab>("overview");
  const [actionError, setActionError] = useState<string | null>(null);

  // Live data sources for the agentic context — same as AiPanel.
  const project = useProject(projectId);
  const characters = useCharactersByProject(projectId);
  const locations = useLocationsByProject(projectId);
  const styleGuide = useStyleGuideByProject(projectId);
  const timelineEvents = useTimelineByProject(projectId);
  const worldbuildingDocs = useWorldbuildingDocsByProject(projectId);
  const relationships = useRelationshipsByProject(projectId);
  const outlineGridColumns = useOutlineGridColumns(projectId);
  const outlineGridRows = useOutlineGridRows(projectId);
  const outlineGridCells = useOutlineGridCells(projectId);
  const chapters = useChaptersByProject(projectId);

  const buildContext = useCallback(async (): Promise<AiContext> => {
    return {
      projectTitle: project?.title ?? "",
      projectDescription: project?.description ?? "",
      genre: project?.genre ?? "",
      projectMode: project?.mode ?? "prose",
      characters: characters ?? [],
      locations: locations ?? [],
      styleGuide: styleGuide ?? [],
      timelineEvents: timelineEvents ?? [],
      worldbuildingDocs: worldbuildingDocs ?? [],
      relationships: relationships ?? [],
      outlineGridColumns: outlineGridColumns ?? [],
      outlineGridRows: outlineGridRows ?? [],
      outlineGridCells: outlineGridCells ?? [],
      chapters: chapters ?? [],
    };
  }, [
    project,
    characters,
    locations,
    styleGuide,
    timelineEvents,
    worldbuildingDocs,
    relationships,
    outlineGridColumns,
    outlineGridRows,
    outlineGridCells,
    chapters,
  ]);

  const isInFlight = !!getRunController(runId);

  async function handleStartReader() {
    setActionError(null);
    try {
      await startReaderPhase({
        runId,
        projectId,
        buildContext,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to start");
    }
  }

  async function handleCancel() {
    cancelRun(runId);
    await updateAgentRunStatus(runId, "cancelled", "Cancelled by user");
  }

  if (!run) return <div className="p-6 text-sm">Loading run…</div>;

  const tokenUsage =
    run.totalTokenUsage.promptTokens + run.totalTokenUsage.completionTokens;
  const budgetPct = Math.min(100, (tokenUsage / run.budgetTokens) * 100);

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
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                {run.statusReason}
              </p>
            )}
          </div>
          <div className="flex gap-2">
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
        </div>

        {actionError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            {actionError}
          </p>
        )}

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
                  {run.readerPasses.map((p) => (
                    <li
                      key={p.passNumber}
                      className="rounded bg-neutral-50 px-3 py-2 dark:bg-neutral-900/50"
                    >
                      <span className="font-medium">Pass {p.passNumber}</span> ·{" "}
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {p.completedAt
                          ? `+${p.newBibleEntries} bible · +${p.newNotes} notes · +${p.newQuestions} questions`
                          : "in progress…"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
        {tab === "bible" && <ReaderBibleView projectId={projectId} />}
        {tab === "notes" && <NotesQuestionsPanel runId={runId} />}
      </div>
    </div>
  );
}
