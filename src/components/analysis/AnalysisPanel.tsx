"use client";

import { useEffect, useState } from "react";
import { useTextAnalysis } from "@/hooks/analysis/useTextAnalysis";
import { getTerm } from "@/lib/terminology";
import type { AnalysisScope } from "@/lib/text-analysis";
import { selectActiveChapterId, useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { AnalysisProgress } from "./AnalysisProgress";
import { ParagraphDensitySection } from "./sections/ParagraphDensitySection";
import { SentenceLengthSection } from "./sections/SentenceLengthSection";
import { SentenceOpenerSection } from "./sections/SentenceOpenerSection";
import { SentenceRhythmSection } from "./sections/SentenceRhythmSection";
import { StickySentencesSection } from "./sections/StickySentencesSection";
import { StyleFlagsSection } from "./sections/StyleFlagsSection";
import { TextComplexitySection } from "./sections/TextComplexitySection";
import { WordEchoesSection } from "./sections/WordEchoesSection";
import { WordFrequencySection } from "./sections/WordFrequencySection";

type AnalysisTab = "chapter" | "project" | "all";

export function AnalysisPanel() {
  const activeChapterId = useEditorStore(selectActiveChapterId);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projectMode = useProjectStore((s) => s.activeProjectMode);

  const [tab, setTab] = useState<AnalysisTab>(
    activeChapterId ? "chapter" : activeProjectId ? "project" : "all",
  );

  // Fall back when the current tab's subject disappears (chapter closed,
  // project navigated away).
  useEffect(() => {
    if (tab === "chapter" && !activeChapterId) {
      setTab(activeProjectId ? "project" : "all");
    } else if (tab === "project" && !activeProjectId) {
      setTab("all");
    }
  }, [tab, activeChapterId, activeProjectId]);

  const scope: AnalysisScope | null =
    tab === "chapter"
      ? activeChapterId
        ? { level: "chapter", chapterId: activeChapterId }
        : null
      : tab === "project"
        ? activeProjectId
          ? { level: "project", projectId: activeProjectId }
          : null
        : { level: "all" };

  const result = useTextAnalysis(scope);
  const analysis = result.chapter ?? result.aggregate;
  const chapterTerm = getTerm(projectMode, "chapter").toLowerCase();

  const tabs: { id: AnalysisTab; label: string; disabled: boolean }[] = [
    {
      id: "chapter",
      label: getTerm(projectMode, "currentChapter"),
      disabled: !activeChapterId,
    },
    { id: "project", label: "Project", disabled: !activeProjectId },
    { id: "all", label: "All Projects", disabled: false },
  ];

  return (
    <div className="flex h-full flex-col bg-neutral-50 dark:bg-neutral-950">
      <div className="flex shrink-0 gap-1 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        {tabs.map(({ id, label, disabled }) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => setTab(id)}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              tab === id
                ? "bg-primary-600 text-white dark:bg-primary-500"
                : disabled
                  ? "cursor-not-allowed text-neutral-300 dark:text-neutral-700"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {result.status === "computing" && (
        <AnalysisProgress
          done={result.progress.done}
          total={result.progress.total}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        {result.status === "empty" ||
        (result.status === "done" && !analysis) ? (
          <p className="px-3 py-3 text-xs text-neutral-400 dark:text-neutral-500">
            Nothing to analyze yet — write something first.
          </p>
        ) : !analysis ? (
          result.status === "loading" ? (
            <p className="px-3 py-3 text-xs text-neutral-400 dark:text-neutral-500">
              Loading…
            </p>
          ) : null
        ) : (
          <>
            <p className="px-3 pt-3 pb-2 text-[11px] text-neutral-400 dark:text-neutral-500">
              {analysis.counts.words.toLocaleString()} words ·{" "}
              {analysis.counts.sentences.toLocaleString()} sentences
              {result.aggregate &&
                ` · ${result.aggregate.chapterCount.toLocaleString()} documents`}
            </p>
            <div className="border-t border-neutral-200 dark:border-neutral-800">
              <TextComplexitySection
                derived={analysis.derived}
                isAggregate={result.aggregate !== null}
              />
              <SentenceLengthSection
                counts={analysis.counts}
                derived={analysis.derived}
              />
              <SentenceRhythmSection
                sentenceWordCounts={result.chapter?.sentenceWordCounts ?? null}
                chapterTerm={chapterTerm}
              />
              <ParagraphDensitySection
                paragraphSummaries={analysis.paragraphSummaries}
                derived={analysis.derived}
              />
              <SentenceOpenerSection derived={analysis.derived} />
              <StyleFlagsSection derived={analysis.derived} />
              <StickySentencesSection
                stickySentences={result.chapter?.stickySentences ?? null}
                chapterTerm={chapterTerm}
              />
              <WordEchoesSection
                echoes={result.chapter?.echoes ?? null}
                chapterTerm={chapterTerm}
              />
              <WordFrequencySection derived={analysis.derived} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
