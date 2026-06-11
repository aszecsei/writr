import type { AnalyzedSentence, StickySentence } from "../types";
import { GLUE_WORDS } from "../word-lists";

/** A sentence is "sticky" above this share of glue words. */
export const STICKY_THRESHOLD = 0.4;

/** Very short sentences are all glue by nature; don't flag them. */
export const STICKY_MIN_WORDS = 8;

const EXCERPT_MAX_LENGTH = 80;

export function countGlueWords(terms: AnalyzedSentence["terms"]): number {
  return terms.filter((t) => GLUE_WORDS.has(t.normal)).length;
}

export function makeExcerpt(text: string): string {
  if (text.length <= EXCERPT_MAX_LENGTH) return text;
  return `${text.slice(0, EXCERPT_MAX_LENGTH - 1).trimEnd()}…`;
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
