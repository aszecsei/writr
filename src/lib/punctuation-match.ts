/**
 * Punctuation-tolerant string matching for LLM-generated anchors.
 *
 * LLMs reliably collapse curly quotes, apostrophes, and primes to their ASCII
 * equivalents when emitting tool-call arguments — even when the source text
 * they were shown contains the typographic forms. This module folds the
 * curly forms (plus non-breaking space) to ASCII for *matching only*, so a
 * `propose_edit` anchor like `said "hello"` still locates `said “hello”`
 * inside a chapter.
 *
 * All mappings are strictly 1 code unit → 1 code unit (BMP only), so the
 * normalized string has the same length and character offsets as the
 * original. Callers can therefore use indices returned from a normalized
 * search to splice the *original* string directly.
 *
 * Length-changing transforms (em dash — → --, ellipsis … → ...) are
 * intentionally NOT applied here. Those need an offset-mapping matcher.
 */

import { escapeRegExp } from "@/lib/text/escape-reg-exp";

const PUNCT_MAP: Record<string, string> = {
  "‘": "'", // left single quotation mark
  "’": "'", // right single quotation mark / apostrophe
  "‚": "'", // single low-9 quotation mark
  "‛": "'", // single high-reversed-9 quotation mark
  "′": "'", // prime
  "“": '"', // left double quotation mark
  "”": '"', // right double quotation mark
  "„": '"', // double low-9 quotation mark
  "‟": '"', // double high-reversed-9 quotation mark
  "″": '"', // double prime
  " ": " ", // non-breaking space
};

/** Derived from PUNCT_MAP's keys, so the two never drift out of sync. */
const PUNCT_RE = new RegExp(
  `[${Object.keys(PUNCT_MAP).map(escapeRegExp).join("")}]`,
  "g",
);

export function normalizePunctuation(s: string): string {
  return s.replace(PUNCT_RE, (ch) => PUNCT_MAP[ch] ?? ch);
}

/**
 * Indexes into `haystack` using a punctuation-normalized comparison. Returns
 * a position in the *original* `haystack` (safe because normalization is
 * 1-char→1-char). Returns -1 when the needle is not found.
 */
export function normalizedIndexOf(
  haystack: string,
  needle: string,
  fromIndex = 0,
): number {
  return normalizePunctuation(haystack).indexOf(
    normalizePunctuation(needle),
    fromIndex,
  );
}

export function normalizedIncludes(haystack: string, needle: string): boolean {
  return normalizedIndexOf(haystack, needle) >= 0;
}

/**
 * Counts non-overlapping occurrences of `needle` in `haystack` under
 * punctuation normalization. Returns 0 for an empty needle.
 */
export function countNormalizedOccurrences(
  haystack: string,
  needle: string,
): number {
  if (needle.length === 0) return 0;
  const h = normalizePunctuation(haystack);
  const n = normalizePunctuation(needle);
  let count = 0;
  let from = 0;
  for (;;) {
    const idx = h.indexOf(n, from);
    if (idx < 0) return count;
    count++;
    from = idx + n.length;
  }
}
