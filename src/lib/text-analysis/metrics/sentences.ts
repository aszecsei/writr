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
