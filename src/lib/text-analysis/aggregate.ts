import { deriveMetrics } from "./analyze";
import {
  type AggregateAnalysis,
  type AnalysisCounts,
  type AnalysisScope,
  type ChapterAnalysis,
  emptyCounts,
  OPENER_CATEGORIES,
} from "./types";

function mergeInto(target: AnalysisCounts, source: AnalysisCounts): void {
  target.words += source.words;
  target.sentences += source.sentences;
  target.paragraphs += source.paragraphs;
  target.syllables += source.syllables;
  target.sentenceLengthSum += source.sentenceLengthSum;
  target.sentenceLengthSumSq += source.sentenceLengthSumSq;
  target.sentenceLengthBuckets.short += source.sentenceLengthBuckets.short;
  target.sentenceLengthBuckets.medium += source.sentenceLengthBuckets.medium;
  target.sentenceLengthBuckets.long += source.sentenceLengthBuckets.long;
  target.sentenceLengthBuckets.veryLong +=
    source.sentenceLengthBuckets.veryLong;
  for (const category of OPENER_CATEGORIES) {
    target.openers[category] += source.openers[category];
  }
  target.passiveSentences += source.passiveSentences;
  target.adverbs += source.adverbs;
  target.lyAdverbs += source.lyAdverbs;
  target.glueWords += source.glueWords;
  target.stickySentences += source.stickySentences;
  for (const [word, count] of Object.entries(source.wordFrequency)) {
    target.wordFrequency[word] = (target.wordFrequency[word] ?? 0) + count;
  }
}

/**
 * Roll chapter analyses up to a project- or library-level view. Every
 * metric except MTLD recomputes exactly from the merged counts; MTLD needs
 * token order, so it falls back to a token-count-weighted average of the
 * per-chapter values (surfaced as approximate in the UI). Echoes and the
 * sticky-sentence list are chapter-scoped and intentionally absent.
 */
export function aggregateAnalyses(
  scope: AnalysisScope,
  analyses: readonly ChapterAnalysis[],
): AggregateAnalysis {
  const counts = emptyCounts();
  for (const analysis of analyses) {
    mergeInto(counts, analysis.counts);
  }

  const mtldWeight = analyses.reduce((sum, a) => sum + a.mtldTokenCount, 0);
  const mtldValue =
    mtldWeight === 0
      ? null
      : analyses.reduce(
          (sum, a) => sum + (a.derived.vocabulary.mtld ?? 0) * a.mtldTokenCount,
          0,
        ) / mtldWeight;

  return {
    scope,
    chapterCount: analyses.length,
    counts,
    derived: deriveMetrics(counts, mtldValue),
    paragraphSummaries: analyses.flatMap((a) => a.paragraphSummaries),
  };
}
