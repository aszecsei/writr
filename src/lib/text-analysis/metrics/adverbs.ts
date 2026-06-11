import type { AnalyzedTerm } from "../types";

export interface AdverbTally {
  adverbs: number;
  lyAdverbs: number;
}

/**
 * Counts rely on compromise's Adverb tag rather than an -ly suffix check,
 * so "family" and "only-as-adjective" don't false-positive; the -ly subset
 * is what style guides usually flag ("ran quickly" vs "ran fast").
 */
export function tallyAdverbs(terms: readonly AnalyzedTerm[]): AdverbTally {
  let adverbs = 0;
  let lyAdverbs = 0;
  for (const term of terms) {
    if (!term.tags.has("Adverb")) continue;
    adverbs += 1;
    if (term.normal.endsWith("ly")) lyAdverbs += 1;
  }
  return { adverbs, lyAdverbs };
}
