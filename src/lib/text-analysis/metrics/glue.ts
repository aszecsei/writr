import { makeExcerpt } from "../excerpt";
import { STICKY_MIN_WORDS, STICKY_THRESHOLD } from "../thresholds";
import type { AnalyzedSentence, AnalyzedTerm, StickySentence } from "../types";
import { GLUE_WORDS } from "../word-lists";

export function countGlueWords(terms: readonly AnalyzedTerm[]): number {
  // Match on the lemma so inflected generic verbs compromise reduces
  // ("seeming" → "seem") count without enumerating every form, but fall back
  // to `normal` so the explicit list still catches irregulars compromise
  // leaves unrooted. Additive: rooting never removes an existing match.
  return terms.filter((t) => GLUE_WORDS.has(t.root) || GLUE_WORDS.has(t.normal))
    .length;
}

/** Returns the sticky-sentence record, or null when the sentence is fine. */
export function checkSticky(
  sentence: AnalyzedSentence,
  sentenceIndex: number,
): StickySentence | null {
  const wordCount = sentence.terms.length;
  if (wordCount < STICKY_MIN_WORDS) return null;
  const gluePct = countGlueWords(sentence.terms) / wordCount;
  if (gluePct <= STICKY_THRESHOLD) return null;
  return {
    sentenceIndex,
    excerpt: makeExcerpt(sentence.text),
    gluePct,
    wordCount,
  };
}
