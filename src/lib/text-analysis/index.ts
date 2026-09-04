export { aggregateAnalyses } from "./aggregate";
export { analyzeSentences } from "./analyze";
export {
  getCachedAnalysis,
  makeAnalysisCacheKey,
  setCachedAnalysis,
} from "./cache";
export {
  ECHO_WINDOW_SENTENCES,
  type EchoSeverity,
  echoProximity,
  echoSeverity,
} from "./metrics/frequency";
export { STICKY_THRESHOLD } from "./metrics/glue";
export { type DensityLevel, paragraphDensityLevel } from "./metrics/paragraphs";
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
  ChapterAnalysis,
  DerivedMetrics,
  Echo,
  OpenerCategory,
  ParagraphSummary,
  SentenceLengthBuckets,
  StickySentence,
} from "./types";
