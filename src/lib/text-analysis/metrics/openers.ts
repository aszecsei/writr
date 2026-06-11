import type { AnalyzedTerm, OpenerCategory } from "../types";
import {
  CONJUNCTION_WORDS,
  DETERMINER_WORDS,
  PREPOSITION_WORDS,
  PRONOUN_WORDS,
} from "../word-lists";

/**
 * Tag-priority order: closed classes first so "But" beats its verb reading,
 * then proper nouns before plain nouns (compromise tags both on names).
 */
const TAG_PRIORITY: readonly [string, OpenerCategory][] = [
  ["Conjunction", "conjunction"],
  ["Preposition", "preposition"],
  ["Determiner", "determiner"],
  ["Pronoun", "pronoun"],
  ["Value", "number"],
  ["Adverb", "adverb"],
  ["ProperNoun", "properNoun"],
  ["Adjective", "adjective"],
  ["Verb", "verb"],
  ["Noun", "noun"],
];

const OPEN_CLASS: ReadonlySet<OpenerCategory> = new Set([
  "adjective",
  "adverb",
  "noun",
  "verb",
  "other",
]);

// Determiner/pronoun outrank conjunction here because words in several
// lists ("that", "some") open sentences as determiners or pronouns far more
// often than as conjunctions — sentence-initial conjunctions ("But", "And")
// are tagged correctly by compromise and never reach this fallback.
function closedClassOverride(normal: string): OpenerCategory | null {
  if (DETERMINER_WORDS.has(normal)) return "determiner";
  if (PRONOUN_WORDS.has(normal)) return "pronoun";
  if (PREPOSITION_WORDS.has(normal)) return "preposition";
  if (CONJUNCTION_WORDS.has(normal)) return "conjunction";
  return null;
}

/** Categorize the part of speech a sentence opens with. */
export function openerCategory(firstTerm: AnalyzedTerm): OpenerCategory {
  const byTag =
    TAG_PRIORITY.find(([tag]) => firstTerm.tags.has(tag))?.[1] ?? "other";

  // compromise occasionally mis-tags closed-class words in open classes
  // (e.g. "under" as Adjective). Closed-class membership is definitional,
  // so the word list wins whenever the tagger landed on an open class.
  if (OPEN_CLASS.has(byTag)) {
    return closedClassOverride(firstTerm.normal) ?? byTag;
  }
  return byTag;
}
