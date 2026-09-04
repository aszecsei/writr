export { aggregateAnalyses } from "./aggregate";
export { analyzeSentences } from "./analyze";
export {
  getCachedAnalysis,
  makeAnalysisCacheKey,
  setCachedAnalysis,
} from "./cache";
export { echoProximity } from "./metrics/frequency";
export { parseParagraph } from "./nlp";
export {
  bucketForLength,
  type DensityLevel,
  type EchoSeverity,
  echoSeverity,
  paragraphDensityLevel,
  readabilityBand,
} from "./presentation";
export {
  markdownToPlainParagraphs,
  screenplayToPlainParagraphs,
} from "./strip";
export {
  ECHO_WINDOW_SENTENCES,
  LONG_MAX,
  MEDIUM_MAX,
  SHORT_MAX,
  STICKY_THRESHOLD,
} from "./thresholds";
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
