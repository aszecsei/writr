import type { SentenceLengthBuckets } from "../types";

export const SHORT_MAX = 7;
export const MEDIUM_MAX = 19;
export const LONG_MAX = 29;

export function bucketForLength(words: number): keyof SentenceLengthBuckets {
  if (words <= SHORT_MAX) return "short";
  if (words <= MEDIUM_MAX) return "medium";
  if (words <= LONG_MAX) return "long";
  return "veryLong";
}

export function meanFromSums(sum: number, count: number): number {
  return count === 0 ? 0 : sum / count;
}

/**
 * Population standard deviation from running sums, so the same formula
 * serves a single chapter and exact aggregation over merged counts.
 */
export function stdDevFromSums(
  sum: number,
  sumSq: number,
  count: number,
): number {
  if (count === 0) return 0;
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  // Floating-point noise can push a zero variance slightly negative.
  return Math.sqrt(Math.max(0, variance));
}
