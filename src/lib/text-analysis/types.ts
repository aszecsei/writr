import type { ChapterId, ProjectId } from "@/db/schemas";

/**
 * Neutral representation of a parsed term, decoupled from compromise's
 * document types so the metric modules never depend on the NLP library.
 */
export interface AnalyzedTerm {
  /** Lowercased, apostrophe-normalized form (compromise `normal`). */
  normal: string;
  /** compromise tag set, e.g. "Adverb", "ProperNoun", "Passive". */
  tags: ReadonlySet<string>;
  syllables: number;
}

export interface AnalyzedSentence {
  /** Original sentence text, used for excerpts. */
  text: string;
  terms: AnalyzedTerm[];
  paragraphIndex: number;
}

export type OpenerCategory =
  | "pronoun"
  | "noun"
  | "properNoun"
  | "verb"
  | "adverb"
  | "adjective"
  | "conjunction"
  | "preposition"
  | "determiner"
  | "number"
  | "other";

export const OPENER_CATEGORIES: readonly OpenerCategory[] = [
  "pronoun",
  "noun",
  "properNoun",
  "verb",
  "adverb",
  "adjective",
  "conjunction",
  "preposition",
  "determiner",
  "number",
  "other",
];

/** Word-count thresholds: short <8, medium 8–19, long 20–29, veryLong ≥30. */
export interface SentenceLengthBuckets {
  short: number;
  medium: number;
  long: number;
  veryLong: number;
}

/**
 * Raw tallies for one chapter. Every field merges across chapters by simple
 * addition (or map-merge for `wordFrequency`), which is what makes exact
 * project- and library-level aggregation possible.
 */
export interface AnalysisCounts {
  words: number;
  sentences: number;
  paragraphs: number;
  syllables: number;
  sentenceLengthSum: number;
  /** Sum of squared sentence lengths — yields exact std-dev after merging. */
  sentenceLengthSumSq: number;
  sentenceLengthBuckets: SentenceLengthBuckets;
  openers: Record<OpenerCategory, number>;
  passiveSentences: number;
  adverbs: number;
  lyAdverbs: number;
  glueWords: number;
  stickySentences: number;
  /**
   * Frequency of every word's normal form, function words included.
   * Stopword filtering happens at read time (top words, echoes) so one map
   * serves frequency, TTR, and root TTR.
   */
  wordFrequency: Record<string, number>;
}

export interface VocabularyMetrics {
  /** Type-token ratio: unique words / total words. */
  ttr: number;
  /** Root TTR (Guiraud's index): unique words / sqrt(total words). */
  rootTtr: number;
  /**
   * Measure of Textual Lexical Diversity. Null below the token minimum;
   * approximate (token-weighted average) at aggregate scopes.
   */
  mtld: number | null;
}

export interface WordCount {
  word: string;
  count: number;
}

/** Metrics derived from counts; always recomputable after merging. */
export interface DerivedMetrics {
  /** Flesch reading ease, clamped to 0–100. */
  fleschReadingEase: number;
  avgSentenceLength: number;
  sentenceLengthStdDev: number;
  vocabulary: VocabularyMetrics;
  avgSentencesPerParagraph: number;
  avgWordsPerParagraph: number;
  /** Share of sentences opened by each category, 0–1. */
  openerPct: Record<OpenerCategory, number>;
  /** Share of sentences in passive voice, 0–1. */
  passivePct: number;
  /** Share of words that are adverbs, 0–1. */
  adverbPct: number;
  lyAdverbsPer1000Words: number;
  /** Share of words that are glue words, 0–1. */
  gluePct: number;
  /** Share of sentences flagged sticky, 0–1. */
  stickyPct: number;
  /** Most-used content words (stopwords excluded), descending. */
  topWords: WordCount[];
}

export interface EchoOccurrence {
  sentenceIndex: number;
  excerpt: string;
}

/** A content word repeated within a few nearby sentences. */
export interface Echo {
  word: string;
  count: number;
  occurrences: EchoOccurrence[];
}

/** Per-paragraph rollup, in document order. Chapter-scoped detail. */
export interface ParagraphSummary {
  sentenceCount: number;
  wordCount: number;
}

export interface StickySentence {
  sentenceIndex: number;
  excerpt: string;
  /** Share of glue words in the sentence, 0–1. */
  gluePct: number;
  wordCount: number;
}

export interface ChapterAnalysis {
  chapterId: ChapterId;
  projectId: ProjectId;
  /** The chapter's updatedAt at analysis time; part of the cache key. */
  sourceUpdatedAt: string;
  counts: AnalysisCounts;
  derived: DerivedMetrics;
  /** Chapter-scoped by definition; never aggregated. */
  echoes: Echo[];
  /** Chapter-scoped detail list; only the percentage aggregates. */
  stickySentences: StickySentence[];
  /**
   * Word count of every sentence in document order. Chapter-scoped — powers
   * the per-sentence rhythm chart; deliberately never aggregated.
   */
  sentenceWordCounts: number[];
  /** Per-paragraph rollups in document order; powers the density heatmap. */
  paragraphSummaries: ParagraphSummary[];
  /** Token count MTLD was computed over, for weighted aggregation. */
  mtldTokenCount: number;
}

export type AnalysisScope =
  | { level: "chapter"; chapterId: ChapterId }
  | { level: "project"; projectId: ProjectId }
  | { level: "all" };

export interface AggregateAnalysis {
  scope: AnalysisScope;
  chapterCount: number;
  counts: AnalysisCounts;
  derived: DerivedMetrics;
  /** Concatenated per-paragraph rollups across chapters, in manuscript order. */
  paragraphSummaries: ParagraphSummary[];
}

export function emptyOpenerCounts(): Record<OpenerCategory, number> {
  return Object.fromEntries(OPENER_CATEGORIES.map((c) => [c, 0])) as Record<
    OpenerCategory,
    number
  >;
}

export function emptyCounts(): AnalysisCounts {
  return {
    words: 0,
    sentences: 0,
    paragraphs: 0,
    syllables: 0,
    sentenceLengthSum: 0,
    sentenceLengthSumSq: 0,
    sentenceLengthBuckets: { short: 0, medium: 0, long: 0, veryLong: 0 },
    openers: emptyOpenerCounts(),
    passiveSentences: 0,
    adverbs: 0,
    lyAdverbs: 0,
    glueWords: 0,
    stickySentences: 0,
    wordFrequency: {},
  };
}
