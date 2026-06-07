/**
 * "Holes" are sections an author intentionally skips over while drafting,
 * leaving a plaintext summary in their place — e.g.
 * `[Tom asks Lara about the mystic skull]`. They are ordinary text delimited
 * by a configurable open/close pair (square brackets by default), not a TipTap
 * node or mark. This module is the single source of truth for detecting them,
 * shared by the editor decoration, the count badges, word counting, and the
 * pre-export warning.
 *
 * Holes are NOT nestable and do not cross block boundaries (the matched content
 * excludes the open delimiter and newlines).
 */

export interface HoleDelimiters {
  open: string;
  close: string;
}

export const DEFAULT_HOLE_DELIMITERS: HoleDelimiters = {
  open: "[",
  close: "]",
};

export interface HoleMatch {
  /** Offset of the open delimiter within the scanned string. */
  index: number;
  /** Length of the whole hole, delimiters included. */
  length: number;
  /** The full matched text, delimiters included. */
  text: string;
}

/** Escape a string so it can be embedded literally in a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Fall back to the default delimiters when either side is empty/blank. */
function normalize(delimiters: HoleDelimiters): HoleDelimiters {
  if (!delimiters.open || !delimiters.close) return DEFAULT_HOLE_DELIMITERS;
  return delimiters;
}

/**
 * Build a global RegExp matching a single hole. The content between the
 * delimiters is non-greedy, may not contain the open delimiter (prevents
 * nesting) and may not span lines (keeps a hole within one block).
 */
export function buildHoleRegex(delimiters: HoleDelimiters): RegExp {
  const { open, close } = normalize(delimiters);
  const openEsc = escapeRegExp(open);
  const closeEsc = escapeRegExp(close);
  // Content: any run of chars that is not a newline and does not start the
  // open or close delimiter, repeated lazily up to the next close delimiter.
  const content = `(?:(?!${openEsc})(?!${closeEsc})[^\\n])*?`;
  return new RegExp(`${openEsc}${content}${closeEsc}`, "g");
}

/** Find every hole in `text`, in document order. */
export function findHoles(
  text: string,
  delimiters: HoleDelimiters,
): HoleMatch[] {
  const regex = buildHoleRegex(delimiters);
  const matches: HoleMatch[] = [];
  let match = regex.exec(text);
  while (match !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      text: match[0],
    });
    // Guard against zero-length matches looping forever.
    if (match[0].length === 0) regex.lastIndex += 1;
    match = regex.exec(text);
  }
  return matches;
}

/** Count the holes in `text`. */
export function countHoles(text: string, delimiters: HoleDelimiters): number {
  return findHoles(text, delimiters).length;
}

/** Remove every hole (delimiters and content) from `text`. */
export function stripHoles(text: string, delimiters: HoleDelimiters): string {
  return text.replace(buildHoleRegex(delimiters), "");
}

/** Count words in `text`, excluding any hole content. */
export function countWordsExcludingHoles(
  text: string,
  delimiters: HoleDelimiters,
): number {
  return stripHoles(text, delimiters).trim().split(/\s+/).filter(Boolean)
    .length;
}
