"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/db/database";
import { getManuscriptChaptersOrdered } from "@/db/operations/chapters";
import type { Chapter, ProjectMode } from "@/db/schemas";
import { isManuscriptDocument } from "@/lib/binder/tree";
import { DEFAULT_HOLE_DELIMITERS, type HoleDelimiters } from "@/lib/holes";
import {
  type AggregateAnalysis,
  type AnalysisScope,
  type AnalyzedSentence,
  aggregateAnalyses,
  analyzeSentences,
  type ChapterAnalysis,
  getCachedAnalysis,
  makeAnalysisCacheKey,
  markdownToPlainParagraphs,
  parseParagraph,
  screenplayToPlainParagraphs,
  setCachedAnalysis,
} from "@/lib/text-analysis";
import { useAppSettings } from "../data/useAppSettings";

export type TextAnalysisStatus = "loading" | "computing" | "done" | "empty";

export interface TextAnalysisResult {
  status: TextAnalysisStatus;
  progress: { done: number; total: number };
  /** Set when the scope is a single chapter. */
  chapter: ChapterAnalysis | null;
  /** Set for project and all-projects scopes. */
  aggregate: AggregateAnalysis | null;
}

interface AnalysisInput {
  chapter: Chapter;
  mode: ProjectMode;
}

/** Keep each synchronous NLP slice well under a frame-budget-busting size. */
const BATCH_WORD_TARGET = 1500;

/** Quiet period after an edit before re-analyzing the changed chapter. */
const RECOMPUTE_DEBOUNCE_MS = 1000;

function idle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function approximateWordCount(text: string): number {
  return text.split(/\s+/).length;
}

async function analyzeChapter(
  input: AnalysisInput,
  delimiters: HoleDelimiters,
  isCancelled: () => boolean,
): Promise<ChapterAnalysis | null> {
  const { chapter, mode } = input;
  const paragraphs =
    mode === "screenplay"
      ? screenplayToPlainParagraphs(chapter.content, delimiters)
      : markdownToPlainParagraphs(chapter.content, delimiters);

  const sentences: AnalyzedSentence[] = [];
  let batchWords = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    if (isCancelled()) return null;
    sentences.push(...(await parseParagraph(paragraphs[i], i)));
    batchWords += approximateWordCount(paragraphs[i]);
    if (batchWords >= BATCH_WORD_TARGET) {
      batchWords = 0;
      await idle();
    }
  }
  if (isCancelled()) return null;

  return analyzeSentences(
    {
      chapterId: chapter.id,
      projectId: chapter.projectId,
      updatedAt: chapter.updatedAt,
    },
    sentences,
  );
}

function scopeKey(scope: AnalysisScope | null): string {
  if (!scope) return "none";
  switch (scope.level) {
    case "chapter":
      return `chapter:${scope.chapterId}`;
    case "project":
      return `project:${scope.projectId}`;
    case "all":
      return "all";
  }
}

/**
 * Deterministic text-pattern analysis for a chapter, a project's manuscript,
 * or every manuscript in the library. Results are computed on demand on the
 * main thread, chunked across idle callbacks so the editor stays responsive,
 * and memoized per chapter in an in-memory cache keyed by `updatedAt` and
 * the hole delimiters.
 */
export function useTextAnalysis(
  scope: AnalysisScope | null,
): TextAnalysisResult {
  const settings = useAppSettings();
  const delimiters = settings?.holeDelimiters ?? DEFAULT_HOLE_DELIMITERS;
  const key = scopeKey(scope);

  // The scope object is recreated by callers each render; `key` captures it.
  const inputs = useLiveQuery(async (): Promise<AnalysisInput[] | null> => {
    if (!scope) return null;
    if (scope.level === "chapter") {
      const chapter = await db.chapters.get(scope.chapterId);
      if (!chapter || !isManuscriptDocument(chapter)) return [];
      const project = await db.projects.get(chapter.projectId);
      return [{ chapter, mode: project?.mode ?? "prose" }];
    }
    if (scope.level === "project") {
      const [chapters, project] = await Promise.all([
        getManuscriptChaptersOrdered(scope.projectId),
        db.projects.get(scope.projectId),
      ]);
      const mode = project?.mode ?? "prose";
      return chapters.map((chapter) => ({ chapter, mode }));
    }
    const [chapters, projects] = await Promise.all([
      db.chapters.toArray(),
      db.projects.toArray(),
    ]);
    const modeByProject = new Map(projects.map((p) => [p.id, p.mode]));
    return chapters.filter(isManuscriptDocument).map((chapter) => ({
      chapter,
      mode: modeByProject.get(chapter.projectId) ?? "prose",
    }));
  }, [key]);

  const [analyses, setAnalyses] = useState<ChapterAnalysis[] | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [isComputing, setIsComputing] = useState(false);
  // Tracks whether this scope has produced results before, so the first
  // open computes immediately while edit-driven recomputes are debounced.
  const hasResultsRef = useRef(false);

  // Drop the previous scope's results immediately so a freshly opened
  // chapter never briefly shows another chapter's numbers.
  // biome-ignore lint/correctness/useExhaustiveDependencies: key change is the reset signal
  useEffect(() => {
    hasResultsRef.current = false;
    setAnalyses(null);
  }, [key]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: delimiters tracked by value (open/close), not identity
  useEffect(() => {
    if (!inputs || !settings) return;

    let cancelled = false;
    const isCancelled = () => cancelled;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cached = new Map<string, ChapterAnalysis>();
    const pending: AnalysisInput[] = [];
    for (const input of inputs) {
      const cacheKey = makeAnalysisCacheKey(
        input.chapter.updatedAt,
        delimiters,
      );
      const hit = getCachedAnalysis(input.chapter.id, cacheKey);
      if (hit) {
        cached.set(input.chapter.id, hit);
      } else {
        pending.push(input);
      }
    }

    const finish = (results: ChapterAnalysis[]) => {
      if (cancelled) return;
      hasResultsRef.current = true;
      setAnalyses(results);
      setIsComputing(false);
      setProgress({ done: inputs.length, total: inputs.length });
    };

    if (pending.length === 0) {
      finish(inputs.map((i) => cached.get(i.chapter.id) as ChapterAnalysis));
      return;
    }

    const run = async () => {
      setIsComputing(true);
      setProgress({ done: cached.size, total: inputs.length });
      for (const input of pending) {
        const analysis = await analyzeChapter(input, delimiters, isCancelled);
        if (cancelled || analysis === null) return;
        setCachedAnalysis(
          input.chapter.id,
          makeAnalysisCacheKey(input.chapter.updatedAt, delimiters),
          analysis,
        );
        cached.set(input.chapter.id, analysis);
        setProgress({ done: cached.size, total: inputs.length });
        await idle();
      }
      finish(inputs.map((i) => cached.get(i.chapter.id) as ChapterAnalysis));
    };

    if (hasResultsRef.current) {
      timer = setTimeout(run, RECOMPUTE_DEBOUNCE_MS);
    } else {
      void run();
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [inputs, settings, delimiters.open, delimiters.close]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scope is keyed by `key`
  return useMemo((): TextAnalysisResult => {
    if (!scope) {
      return { status: "empty", progress, chapter: null, aggregate: null };
    }
    if (!inputs || !settings || analyses === null) {
      // First computation for this scope: no stale data to show, but the
      // progress counter is already meaningful.
      return {
        status: isComputing ? "computing" : "loading",
        progress,
        chapter: null,
        aggregate: null,
      };
    }
    if (inputs.length === 0) {
      return { status: "empty", progress, chapter: null, aggregate: null };
    }
    const status: TextAnalysisStatus = isComputing ? "computing" : "done";
    if (scope.level === "chapter") {
      return {
        status,
        progress,
        chapter: analyses[0] ?? null,
        aggregate: null,
      };
    }
    return {
      status,
      progress,
      chapter: null,
      aggregate: aggregateAnalyses(scope, analyses),
    };
  }, [key, inputs, settings, analyses, isComputing, progress]);
}
