import type { AnalyzedSentence } from "../types";

const BE_FORMS = new Set([
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "am",
]);

/**
 * A sentence is passive when compromise tagged a passive construction, or —
 * because the tagger misses some constructions — when a be-form is followed
 * within two terms (adverbs may intervene: "was quickly eaten") by a
 * past-tense or participle verb. Gerunds are explicitly excluded so
 * progressive aspect ("was running") never counts.
 */
export function isPassiveSentence(sentence: AnalyzedSentence): boolean {
  const { terms } = sentence;
  if (terms.some((t) => t.tags.has("Passive"))) return true;

  for (let i = 0; i < terms.length - 1; i++) {
    if (!BE_FORMS.has(terms[i].normal)) continue;
    for (let j = i + 1; j <= Math.min(i + 2, terms.length - 1); j++) {
      const candidate = terms[j];
      if (candidate.tags.has("Adverb")) continue;
      if (candidate.tags.has("Gerund")) break;
      if (
        candidate.tags.has("Verb") &&
        (candidate.tags.has("PastTense") || candidate.tags.has("Participle"))
      ) {
        return true;
      }
      break;
    }
  }
  return false;
}
