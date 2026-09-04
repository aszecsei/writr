import { describe, expect, it } from "vitest";
import type { ChapterId, ProjectId } from "@/db/schemas";
import { aggregateAnalyses } from "./aggregate";
import { analyzeSentences } from "./analyze";
import { term } from "./test-helpers";
import type { AnalysisScope, AnalyzedSentence } from "./types";

const PROJECT_ID = "project-1" as ProjectId;
const SCOPE: AnalysisScope = { level: "project", projectId: PROJECT_ID };

function sentencesFromWords(
  wordsPerSentence: string[][],
  paragraphIndex = 0,
): AnalyzedSentence[] {
  return wordsPerSentence.map((words) => ({
    text: words.join(" "),
    terms: words.map((w) => term(w)),
    paragraphIndex,
  }));
}

function chapterOf(id: string, sentences: AnalyzedSentence[]) {
  return analyzeSentences(
    {
      chapterId: id as ChapterId,
      projectId: PROJECT_ID,
      updatedAt: "2026-06-10T00:00:00.000Z",
    },
    sentences,
  );
}

describe("aggregateAnalyses", () => {
  const chapterA = sentencesFromWords([
    ["the", "dragon", "slept"],
    ["fire", "curled", "from", "its", "nostrils", "while", "it", "dreamed"],
  ]);
  const chapterB = sentencesFromWords([
    ["a", "knight", "approached", "the", "mountain", "slowly"],
    ["dragon", "scales", "littered", "the", "path"],
  ]);

  it("matches direct computation on the concatenated input", () => {
    const merged = aggregateAnalyses(SCOPE, [
      chapterOf("a", chapterA),
      chapterOf("b", chapterB),
    ]);
    const direct = chapterOf("all", [...chapterA, ...chapterB]);

    expect(merged.counts.words).toBe(direct.counts.words);
    expect(merged.counts.sentences).toBe(direct.counts.sentences);
    expect(merged.counts.wordFrequency).toEqual(direct.counts.wordFrequency);
    expect(merged.derived.avgSentenceLength).toBeCloseTo(
      direct.derived.avgSentenceLength,
      10,
    );
    expect(merged.derived.sentenceLengthStdDev).toBeCloseTo(
      direct.derived.sentenceLengthStdDev,
      10,
    );
    expect(merged.derived.fleschReadingEase).toBeCloseTo(
      direct.derived.fleschReadingEase,
      10,
    );
    expect(merged.derived.vocabulary.ttr).toBeCloseTo(
      direct.derived.vocabulary.ttr,
      10,
    );
    expect(merged.derived.gluePct).toBeCloseTo(direct.derived.gluePct, 10);
  });

  // Both chapters share one paragraphIndex per chapter, but they are
  // different paragraphs in different chapters — the merged paragraph count
  // must be the sum, not a dedupe.
  it("sums paragraph counts across chapters", () => {
    const merged = aggregateAnalyses(SCOPE, [
      chapterOf("a", chapterA),
      chapterOf("b", chapterB),
    ]);
    expect(merged.counts.paragraphs).toBe(2);
  });

  it("weights MTLD by token count and reports chapter count", () => {
    const longWords = Array.from({ length: 60 }, (_, i) => `unique${i}`);
    const repetitive = Array.from({ length: 60 }, (_, i) =>
      i % 2 === 0 ? "ping" : "pong",
    );
    const diverse = chapterOf("a", sentencesFromWords([longWords]));
    const dull = chapterOf("b", sentencesFromWords([repetitive]));

    const merged = aggregateAnalyses(SCOPE, [diverse, dull]);
    expect(merged.chapterCount).toBe(2);
    const expected =
      ((diverse.derived.vocabulary.mtld as number) * 60 +
        (dull.derived.vocabulary.mtld as number) * 60) /
      120;
    expect(merged.derived.vocabulary.mtld).toBeCloseTo(expected, 10);
  });

  it("reports null MTLD when no chapter met the token minimum", () => {
    const merged = aggregateAnalyses(SCOPE, [
      chapterOf("a", sentencesFromWords([["too", "short"]])),
    ]);
    expect(merged.derived.vocabulary.mtld).toBeNull();
  });

  it("returns empty counts for no chapters", () => {
    const merged = aggregateAnalyses({ level: "all" }, []);
    expect(merged.chapterCount).toBe(0);
    expect(merged.counts.words).toBe(0);
    expect(merged.derived.fleschReadingEase).toBe(0);
    expect(merged.paragraphSummaries).toEqual([]);
  });

  it("concatenates paragraph summaries in chapter order", () => {
    const merged = aggregateAnalyses(SCOPE, [
      chapterOf("a", chapterA),
      chapterOf("b", chapterB),
    ]);
    expect(merged.paragraphSummaries).toEqual([
      { sentenceCount: 2, wordCount: 11 },
      { sentenceCount: 2, wordCount: 11 },
    ]);
  });
});
