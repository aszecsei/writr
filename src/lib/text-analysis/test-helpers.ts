import type { AnalyzedSentence, AnalyzedTerm } from "./types";

export function term(normal: string, ...tags: string[]): AnalyzedTerm {
  return { normal, root: normal, tags: new Set(tags), syllables: 1 };
}

/** Term whose lemma differs from its surface form (e.g. "wonders" → "wonder"). */
export function rootedTerm(
  normal: string,
  root: string,
  ...tags: string[]
): AnalyzedTerm {
  return { normal, root, tags: new Set(tags), syllables: 1 };
}

export function sentence(
  terms: AnalyzedTerm[],
  paragraphIndex = 0,
): AnalyzedSentence {
  return {
    text: terms.map((t) => t.normal).join(" "),
    terms,
    paragraphIndex,
  };
}
