export { aggregateAnalyses } from "./aggregate";
export {
  analyzeSentences,
  type ChapterAnalysisSource,
  deriveMetrics,
} from "./analyze";
export {
  clearAnalysisCache,
  getCachedAnalysis,
  makeAnalysisCacheKey,
  setCachedAnalysis,
} from "./cache";
export {
  ECHO_WINDOW_SENTENCES,
  type EchoProximity,
  type EchoSeverity,
  echoProximity,
  echoSeverity,
} from "./metrics/frequency";
export {
  DENSITY_STEPS,
  type DensityLevel,
  paragraphDensityLevel,
} from "./metrics/paragraphs";
export { readabilityBand } from "./metrics/readability";
export {
  bucketForLength,
  LONG_MAX,
  MEDIUM_MAX,
  SHORT_MAX,
} from "./metrics/sentences";
export { parseParagraph } from "./nlp";
export {
  markdownToPlainParagraphs,
  screenplayToPlainParagraphs,
} from "./strip";
export type {
  AggregateAnalysis,
  AnalysisCounts,
  AnalysisScope,
  AnalyzedSentence,
  AnalyzedTerm,
  ChapterAnalysis,
  DerivedMetrics,
  Echo,
  EchoOccurrence,
  OpenerCategory,
  ParagraphSummary,
  SentenceLengthBuckets,
  StickySentence,
  VocabularyMetrics,
  WordCount,
} from "./types";
export { OPENER_CATEGORIES } from "./types";
