"use client";

import { useState } from "react";
import { AccordionSection } from "@/components/ui/AccordionSection";
import { BUTTON_CANCEL, BUTTON_PRIMARY } from "@/components/ui/button-styles";
import type { ChapterId, ProjectId, ProjectMode } from "@/db/schemas";
import { useRepeatedPassages } from "@/hooks/analysis/useRepeatedPassages";
import type { ComparisonContext } from "@/lib/binder/contexts";
import { getTerm } from "@/lib/terminology";
import { AnalysisProgress } from "../AnalysisProgress";
import { RepeatedPassageRow } from "./RepeatedPassageRow";

const VISIBLE_CLUSTERS = 10;

const SELECT_CLASS =
  "block w-full min-w-0 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100";
const COMPACT_BUTTON = "!px-2.5 !py-1 !text-xs shrink-0";

function contextLabel(context: ComparisonContext, mode: ProjectMode): string {
  if (context.kind === "project") return getTerm(mode, "entireBook");
  const title =
    context.title.trim() ||
    (context.kind === "separatorGroup"
      ? "Untitled section"
      : getTerm(mode, "untitledChapter"));
  return `${"  ".repeat(context.depth + 1)}${title}`;
}

function countLabel(context: ComparisonContext, mode: ProjectMode): string {
  const n = context.chapterIds.length;
  return `${n} ${getTerm(mode, n === 1 ? "chapter" : "chapters").toLowerCase()}`;
}

interface RepeatedPassagesSectionProps {
  /** Set only on the Project tab; the comparison is project-scoped. */
  projectId: ProjectId | null;
  projectMode: ProjectMode | null;
}

export function RepeatedPassagesSection({
  projectId,
  projectMode,
}: RepeatedPassagesSectionProps) {
  return (
    <AccordionSection
      title="Repeated passages"
      description="Wording you've reused elsewhere."
    >
      {projectId === null ? (
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          Repeated passages are found across one project's{" "}
          {getTerm(projectMode, "chapters").toLowerCase()}. Open the Project tab
          to run it.
        </p>
      ) : (
        <RepeatedPassagesBody
          key={projectId}
          projectId={projectId}
          mode={projectMode ?? "prose"}
        />
      )}
    </AccordionSection>
  );
}

function RepeatedPassagesBody({
  projectId,
  mode,
}: {
  projectId: ProjectId;
  mode: ProjectMode;
}) {
  const state = useRepeatedPassages(projectId, mode);
  const [showAll, setShowAll] = useState(false);
  const chapterTerm = getTerm(mode, "chapter");

  if (!state.contexts) {
    return (
      <p className="text-xs text-neutral-400 dark:text-neutral-500">Loading…</p>
    );
  }

  const selected = state.contexts.find((c) => c.id === state.contextId);
  const resultContext = state.result
    ? state.contexts.find((c) => c.id === state.result?.contextId)
    : undefined;
  const titleOf = (id: ChapterId) =>
    state.chapterTitles.get(id) || `Deleted ${chapterTerm.toLowerCase()}`;

  const clusters = state.result?.report.clusters ?? [];
  const visible = showAll ? clusters : clusters.slice(0, VISIBLE_CLUSTERS);
  const topScore = clusters[0]?.score ?? 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {/* aria-label rather than an sr-only <label>: sr-only is absolutely
            positioned, and with no positioned ancestor it escapes the
            panel's scroll container and stretches the whole page. */}
        <select
          aria-label="Compare within"
          value={state.contextId}
          onChange={(e) => state.setContextId(e.target.value)}
          disabled={state.running}
          className={SELECT_CLASS}
        >
          {state.contexts.map((context) => (
            <option key={context.id} value={context.id}>
              {contextLabel(context, mode)} ({countLabel(context, mode)})
            </option>
          ))}
        </select>
        {state.running ? (
          <button
            type="button"
            onClick={state.cancel}
            className={`${BUTTON_CANCEL} ${COMPACT_BUTTON}`}
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={state.run}
            disabled={!selected}
            className={`${BUTTON_PRIMARY} ${COMPACT_BUTTON}`}
          >
            {state.result ? "Re-run" : "Run"}
          </button>
        )}
      </div>

      {state.running && (
        <div className="-mx-3">
          <AnalysisProgress
            done={state.progress.done}
            total={state.progress.total}
          />
        </div>
      )}

      {state.error && (
        <p className="rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-400">
          {state.error}
        </p>
      )}

      {!state.result && !state.running && (
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          Runs on this device; nothing is sent anywhere.
        </p>
      )}

      {state.result && (
        <>
          {(state.isStale || state.result.contextId !== state.contextId) && (
            <p className="rounded-md bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800 dark:bg-amber-950/50 dark:text-amber-400">
              {state.isStale
                ? `The manuscript changed since this ran. Re-run to refresh.`
                : `Showing results for ${resultContext ? contextLabel(resultContext, mode).trim() : "a previous selection"}. Run to compare the selected ${getTerm(mode, "chapters").toLowerCase()}.`}
            </p>
          )}
          {clusters.length === 0 ? (
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              No repeated passages found.
            </p>
          ) : (
            <>
              <div className="flex items-baseline gap-2 rounded-md bg-neutral-100 px-2.5 py-2 dark:bg-neutral-900">
                <span className="text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                  {clusters.length}
                </span>
                <span className="text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
                  repeated {clusters.length === 1 ? "passage" : "passages"} · ~
                  {state.result.report.totalRedundantWords.toLocaleString()}{" "}
                  redundant words
                </span>
              </div>
              <ul className="space-y-3">
                {visible.map((cluster) => (
                  <RepeatedPassageRow
                    key={cluster.id}
                    cluster={cluster}
                    topScore={topScore}
                    projectId={projectId}
                    titleOf={titleOf}
                  />
                ))}
              </ul>
              {clusters.length > VISIBLE_CLUSTERS && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="text-[11px] text-primary-600 hover:underline dark:text-primary-400"
                >
                  {showAll
                    ? "Show fewer"
                    : `Show all ${clusters.length} passages`}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
