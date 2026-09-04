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

interface ReadabilityBand {
  label: string;
  /** Inclusive lower bound of the band. */
  min: number;
}

const BANDS: readonly ReadabilityBand[] = [
  { label: "Very easy", min: 90 },
  { label: "Easy", min: 80 },
  { label: "Fairly easy", min: 70 },
  { label: "Standard", min: 60 },
  { label: "Fairly difficult", min: 50 },
  { label: "Difficult", min: 30 },
  { label: "Very difficult", min: 0 },
];

export function readabilityBand(score: number): string {
  const band = BANDS.find((b) => score >= b.min);
  return band ? band.label : "Very difficult";
}
