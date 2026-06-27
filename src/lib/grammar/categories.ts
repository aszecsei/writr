/**
 * User-facing grammar categories, derived from harper's `lint_kind()` values.
 *
 * These are filtered post-hoc on lint results (by kind), giving a coarse on/off
 * control that complements the per-rule overrides. `Spelling` and `Typo` are
 * intentionally omitted — nspell owns spelling, and those kinds are always
 * filtered out (see `SPELLING_KINDS` in `index.ts`).
 */
export interface GrammarCategory {
  /** The exact string returned by `lint.lint_kind()`. */
  kind: string;
  label: string;
  description: string;
}

export const GRAMMAR_CATEGORIES: GrammarCategory[] = [
  {
    kind: "Agreement",
    label: "Agreement",
    description: "Subject–verb and noun agreement (e.g. “he go”).",
  },
  {
    kind: "Capitalization",
    label: "Capitalization",
    description: "Sentence and proper-noun capitalization.",
  },
  {
    kind: "Punctuation",
    label: "Punctuation",
    description: "Commas, apostrophes, quotes, and spacing.",
  },
  {
    kind: "Grammar",
    label: "Grammar",
    description: "General grammatical errors.",
  },
  {
    kind: "Usage",
    label: "Usage",
    description: "Word usage and idiomatic correctness.",
  },
  {
    kind: "WordChoice",
    label: "Word choice",
    description: "Suggestions for clearer or more precise wording.",
  },
  {
    kind: "Style",
    label: "Style",
    description: "Stylistic preferences and tone.",
  },
  {
    kind: "Readability",
    label: "Readability",
    description: "Long or hard-to-read sentences.",
  },
  {
    kind: "Redundancy",
    label: "Redundancy",
    description: "Redundant or unnecessary words.",
  },
  {
    kind: "Repetition",
    label: "Repetition",
    description: "Repeated words (e.g. “the the”).",
  },
  {
    kind: "Enhancement",
    label: "Enhancement",
    description: "Optional improvements to the text.",
  },
  {
    kind: "Eggcorn",
    label: "Eggcorn",
    description: "Misheard phrases (e.g. “for all intensive purposes”).",
  },
  {
    kind: "Malapropism",
    label: "Malapropism",
    description: "Confused similar-sounding words.",
  },
  {
    kind: "Nonstandard",
    label: "Nonstandard",
    description: "Nonstandard English constructions.",
  },
  {
    kind: "Regionalism",
    label: "Regionalism",
    description: "Region-specific spellings and usage.",
  },
  {
    kind: "BoundaryError",
    label: "Boundary errors",
    description: "Word- and sentence-boundary mistakes.",
  },
  {
    kind: "Formatting",
    label: "Formatting",
    description: "Whitespace and formatting issues.",
  },
  {
    kind: "Miscellaneous",
    label: "Miscellaneous",
    description: "Other issues that don't fit a category.",
  },
];
