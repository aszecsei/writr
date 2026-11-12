"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Chapter, ChapterId, ProjectId, ProjectMode } from "@/db/schemas";
import {
  type ComparisonContext,
  listComparisonContexts,
} from "@/lib/binder/contexts";
import { DEFAULT_HOLE_DELIMITERS } from "@/lib/holes";
import { idle } from "@/lib/idle";
import { findRepeatedPassages } from "@/lib/text-analysis/repeats/find-repeats";
import { makeRepeatRunKey } from "@/lib/text-analysis/repeats/run-key";
import { tokenizeChapter } from "@/lib/text-analysis/repeats/tokenize";
import type { RepeatReport } from "@/lib/text-analysis/repeats/types";
import { chapterPlainParagraphs } from "@/lib/text-analysis/strip";
import { useAppSettings } from "../data/useAppSettings";
import { useChaptersByProject } from "../data/useChapter";

interface CompletedRun {
  contextId: string;
  runKey: string;
  report: RepeatReport;
}

/**
 * Last finished run per project, so results survive closing the panel or
 * switching tabs. Derived data — never persisted, and too large to be worth
 * routing through an Immer-backed store.
 */
const lastRuns = new Map<ProjectId, CompletedRun>();

export interface RepeatedPassagesState {
  /** Undefined while the binder is loading. */
  contexts: ComparisonContext[] | undefined;
  contextId: string;
  setContextId: (id: string) => void;
  running: boolean;
  progress: { done: number; total: number };
  error: string | null;
  /** The last finished run, possibly for a different context than selected. */
  result: { contextId: string; report: RepeatReport } | null;
  /** True when chapters in the result's context changed since it ran. */
  isStale: boolean;
  chapterTitles: ReadonlyMap<ChapterId, string>;
  run: () => void;
  cancel: () => void;
}

function chaptersOf(
  context: ComparisonContext,
  byId: ReadonlyMap<ChapterId, Chapter>,
): Chapter[] {
  return context.chapterIds.flatMap((id) => {
    const chapter = byId.get(id);
    return chapter ? [chapter] : [];
  });
}

/**
 * On-demand repeated-passage detection for one project, confined to a
 * chosen comparison context. Tokenizes chapter by chapter across idle
 * callbacks, then matches synchronously (fast: hashing, not NLP).
 */
export function useRepeatedPassages(
  projectId: ProjectId,
  mode: ProjectMode,
): RepeatedPassagesState {
  const items = useChaptersByProject(projectId);
  const settings = useAppSettings();
  const delimiters = settings?.holeDelimiters ?? DEFAULT_HOLE_DELIMITERS;

  const contexts = useMemo(
    () => (items ? listComparisonContexts(items) : undefined),
    [items],
  );
  const byId = useMemo(
    () => new Map<ChapterId, Chapter>((items ?? []).map((c) => [c.id, c])),
    [items],
  );
  const chapterTitles = useMemo(
    () => new Map<ChapterId, string>((items ?? []).map((c) => [c.id, c.title])),
    [items],
  );

  const [selectedId, setContextId] = useState("project");
  const contextId = contexts?.some((c) => c.id === selectedId)
    ? selectedId
    : "project";

  const [completed, setCompleted] = useState<CompletedRun | null>(
    () => lastRuns.get(projectId) ?? null,
  );
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const activeRun = useRef<{ cancelled: boolean } | null>(null);

  useEffect(
    () => () => {
      if (activeRun.current) activeRun.current.cancelled = true;
    },
    [],
  );

  const run = (): void => {
    const context = contexts?.find((c) => c.id === contextId);
    if (!context) return;
    if (activeRun.current) activeRun.current.cancelled = true;
    const token = { cancelled: false };
    activeRun.current = token;

    const chapters = chaptersOf(context, byId);
    const runKey = makeRepeatRunKey(chapters, mode, delimiters);
    setRunning(true);
    setError(null);
    setProgress({ done: 0, total: chapters.length });

    void (async () => {
      try {
        const tokenized = [];
        for (let i = 0; i < chapters.length; i++) {
          const chapter = chapters[i];
          tokenized.push(
            tokenizeChapter(
              chapter.id,
              chapterPlainParagraphs(chapter.content, mode, delimiters),
            ),
          );
          setProgress({ done: i + 1, total: chapters.length });
          await idle();
          if (token.cancelled) return;
        }
        const report = findRepeatedPassages(tokenized, {
          isCancelled: () => token.cancelled,
        });
        if (!report || token.cancelled) return;
        const done: CompletedRun = { contextId: context.id, runKey, report };
        lastRuns.set(projectId, done);
        setCompleted(done);
      } catch (e) {
        if (!token.cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (activeRun.current === token) {
          activeRun.current = null;
          setRunning(false);
        }
      }
    })();
  };

  const cancel = (): void => {
    if (activeRun.current) activeRun.current.cancelled = true;
    activeRun.current = null;
    setRunning(false);
  };

  // Hashes the context's text, so recompute only when the chapters change,
  // not on every progress tick.
  const isStale = useMemo(() => {
    if (!completed || !contexts) return false;
    const context = contexts.find((c) => c.id === completed.contextId);
    return (
      !context ||
      makeRepeatRunKey(chaptersOf(context, byId), mode, delimiters) !==
        completed.runKey
    );
  }, [completed, contexts, byId, mode, delimiters]);

  return {
    contexts,
    contextId,
    setContextId,
    running,
    progress,
    error,
    result: completed
      ? { contextId: completed.contextId, report: completed.report }
      : null,
    isStale,
    chapterTitles,
    run,
    cancel,
  };
}
