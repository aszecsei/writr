import { echoProximity } from "./metrics/frequency";
import {
  DENSITY_BREAKPOINTS,
  LONG_MAX,
  MEDIUM_MAX,
  SHORT_MAX,
} from "./thresholds";
import type { Echo, ParagraphSummary, SentenceLengthBuckets } from "./types";

/**
 * Banding helpers: map a raw metric onto the coarse bucket or label a
 * component renders. Collected here so the mapping tables live next to each
 * other instead of scattered across the metric modules that compute the
 * underlying numbers.
 */

interface ReadabilityBand {
  label: string;
  /** Inclusive lower bound of the band. */
  min: number;
}

const READABILITY_BANDS: readonly ReadabilityBand[] = [
  { label: "Very easy", min: 90 },
  { label: "Easy", min: 80 },
  { label: "Fairly easy", min: 70 },
  { label: "Standard", min: 60 },
  { label: "Fairly difficult", min: 50 },
  { label: "Difficult", min: 30 },
  { label: "Very difficult", min: 0 },
];

export function readabilityBand(score: number): string {
  const band = READABILITY_BANDS.find((b) => score >= b.min);
  return band ? band.label : "Very difficult";
}

export type DensityLevel = 0 | 1 | 2 | 3 | 4;

/** Map a paragraph to a 0–4 heatmap shade by its average sentence length. */
export function paragraphDensityLevel(
  paragraph: ParagraphSummary,
): DensityLevel {
  if (paragraph.sentenceCount === 0) return 0;
  const avgSentenceLength = paragraph.wordCount / paragraph.sentenceCount;
  let level = 0;
  for (const breakpoint of DENSITY_BREAKPOINTS) {
    if (avgSentenceLength <= breakpoint) break;
    level += 1;
  }
  return level as DensityLevel;
}

export type EchoSeverity = "dense" | "echo";

/**
 * Dense echoes repeat often (4+) or pile up in adjacent sentences (3+ with
 * back-to-back uses); everything else detected is an ordinary echo.
 */
export function echoSeverity(echo: Echo): EchoSeverity {
  if (echo.count >= 4) return "dense";
  if (echo.count >= 3 && echoProximity(echo).minGap <= 1) return "dense";
  return "echo";
}

export function bucketForLength(words: number): keyof SentenceLengthBuckets {
  if (words <= SHORT_MAX) return "short";
  if (words <= MEDIUM_MAX) return "medium";
  if (words <= LONG_MAX) return "long";
  return "veryLong";
}
