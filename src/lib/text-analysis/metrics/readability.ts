/**
 * Flesch reading ease: 206.835 − 1.015·(words/sentences) − 84.6·(syllables/words),
 * clamped to 0–100. Computed from raw tallies so aggregate scopes can derive
 * it exactly from merged counts.
 */
export function fleschReadingEase(
  words: number,
  sentences: number,
  syllables: number,
): number {
  if (words === 0 || sentences === 0) return 0;
  const score =
    206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  return Math.min(100, Math.max(0, score));
}
