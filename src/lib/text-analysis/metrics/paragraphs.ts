import type { ParagraphSummary } from "../types";

/** Number of shades in the paragraph-density heatmap scale. */
export const DENSITY_STEPS = 5;

export type DensityLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Average-sentence-length breakpoints between density levels: a paragraph of
 * short, punchy sentences reads light (0); long winding sentences read
 * dense (4). Words-per-paragraph already has its own stat row, so density
 * deliberately measures sentence length, not paragraph bulk.
 */
const DENSITY_BREAKPOINTS = [8, 14, 20, 26] as const;

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
