import type { ChapterId, ProjectId } from "@/db/schemas";
import { tallyAdverbs } from "./metrics/adverbs";
import { detectEchoes, topContentWords } from "./metrics/frequency";
import { checkSticky, countGlueWords } from "./metrics/glue";
import { openerCategory } from "./metrics/openers";
import { isPassiveSentence } from "./metrics/passive";
import { fleschReadingEase } from "./metrics/readability";
import {
  bucketForLength,
  meanFromSums,
  stdDevFromSums,
} from "./metrics/sentences";
import { mtld, ttrFromFrequency } from "./metrics/vocabulary";
import {
  type AnalysisCounts,
  type AnalyzedSentence,
  type ChapterAnalysis,
  type DerivedMetrics,
  emptyCounts,
  type ParagraphSummary,
  type StickySentence,
} from "./types";

const STICKY_LIST_LIMIT = 30;

export interface ChapterAnalysisSource {
  chapterId: ChapterId;
  projectId: ProjectId;
  updatedAt: string;
}

function buildCounts(sentences: readonly AnalyzedSentence[]): {
  counts: AnalysisCounts;
  stickySentences: StickySentence[];
  sentenceWordCounts: number[];
  paragraphSummaries: ParagraphSummary[];
} {
  const counts = emptyCounts();
  const stickySentences: StickySentence[] = [];
  const sentenceWordCounts: number[] = [];
  // Sentences arrive in document order, so Map insertion order matches
  // paragraph order.
  const paragraphMap = new Map<number, ParagraphSummary>();

  sentences.forEach((sentence, sentenceIndex) => {
    const length = sentence.terms.length;
    sentenceWordCounts.push(length);
    const paragraph = paragraphMap.get(sentence.paragraphIndex);
    if (paragraph) {
      paragraph.sentenceCount += 1;
      paragraph.wordCount += length;
    } else {
      paragraphMap.set(sentence.paragraphIndex, {
        sentenceCount: 1,
        wordCount: length,
      });
    }

    counts.sentences += 1;
    counts.words += length;
    counts.sentenceLengthSum += length;
    counts.sentenceLengthSumSq += length * length;
    counts.sentenceLengthBuckets[bucketForLength(length)] += 1;
    counts.openers[openerCategory(sentence.terms[0])] += 1;
    if (isPassiveSentence(sentence)) counts.passiveSentences += 1;

    const adverbTally = tallyAdverbs(sentence.terms);
    counts.adverbs += adverbTally.adverbs;
    counts.lyAdverbs += adverbTally.lyAdverbs;
    counts.glueWords += countGlueWords(sentence.terms);

    const sticky = checkSticky(sentence, sentenceIndex);
    if (sticky) {
      counts.stickySentences += 1;
      stickySentences.push(sticky);
    }

    for (const term of sentence.terms) {
      counts.syllables += term.syllables;
      counts.wordFrequency[term.normal] =
        (counts.wordFrequency[term.normal] ?? 0) + 1;
    }
  });

  counts.paragraphs = paragraphMap.size;
  return {
    counts,
    stickySentences,
    sentenceWordCounts,
    paragraphSummaries: [...paragraphMap.values()],
  };
}

/**
 * Derive every recomputable metric from raw counts. Shared by the
 * per-chapter path and the aggregate path — only MTLD needs token order
 * and is supplied by the caller.
 */
export function deriveMetrics(
  counts: AnalysisCounts,
  mtldValue: number | null,
): DerivedMetrics {
  const { words, sentences, paragraphs } = counts;
  const openerPct = Object.fromEntries(
    Object.entries(counts.openers).map(([category, count]) => [
      category,
      sentences === 0 ? 0 : count / sentences,
    ]),
  ) as DerivedMetrics["openerPct"];

  return {
    fleschReadingEase: fleschReadingEase(words, sentences, counts.syllables),
    avgSentenceLength: meanFromSums(counts.sentenceLengthSum, sentences),
    sentenceLengthStdDev: stdDevFromSums(
      counts.sentenceLengthSum,
      counts.sentenceLengthSumSq,
      sentences,
    ),
    vocabulary: { ...ttrFromFrequency(counts.wordFrequency), mtld: mtldValue },
    avgSentencesPerParagraph: meanFromSums(sentences, paragraphs),
    avgWordsPerParagraph: meanFromSums(words, paragraphs),
    openerPct,
    passivePct: sentences === 0 ? 0 : counts.passiveSentences / sentences,
    adverbPct: words === 0 ? 0 : counts.adverbs / words,
    lyAdverbsPer1000Words: words === 0 ? 0 : (counts.lyAdverbs / words) * 1000,
    gluePct: words === 0 ? 0 : counts.glueWords / words,
    stickyPct: sentences === 0 ? 0 : counts.stickySentences / sentences,
    topWords: topContentWords(counts.wordFrequency),
  };
}

/**
 * Finalize one chapter's analysis from its parsed sentences. Synchronous —
 * callers drive (and chunk) the NLP parsing, then hand the accumulated
 * sentence stream here.
 */
export function analyzeSentences(
  source: ChapterAnalysisSource,
  sentences: readonly AnalyzedSentence[],
): ChapterAnalysis {
  const { counts, stickySentences, sentenceWordCounts, paragraphSummaries } =
    buildCounts(sentences);
  const orderedTokens = sentences.flatMap((s) => s.terms.map((t) => t.normal));
  const mtldValue = mtld(orderedTokens);

  return {
    chapterId: source.chapterId,
    projectId: source.projectId,
    sourceUpdatedAt: source.updatedAt,
    counts,
    derived: deriveMetrics(counts, mtldValue),
    echoes: detectEchoes(sentences),
    stickySentences: stickySentences
      .sort((a, b) => b.gluePct - a.gluePct)
      .slice(0, STICKY_LIST_LIMIT),
    sentenceWordCounts,
    paragraphSummaries,
    mtldTokenCount: mtldValue === null ? 0 : orderedTokens.length,
  };
}
