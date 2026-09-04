import type { Mark, Node as ProseMirrorNode } from "@tiptap/pm/model";
import { extractTextBlocks } from "@/lib/prosemirror/extract-text-blocks";

export interface Replacement {
  from: number;
  to: number;
  replacement: string;
  /** Marks active on the source text node, so the replacement preserves formatting. */
  marks: readonly Mark[];
}

/** Smart-quote glyph for each straight quote character, by context. */
const SMART_QUOTES: Record<string, { open: string; close: string }> = {
  '"': { open: "“", close: "”" },
  "'": { open: "‘", close: "’" },
};

/**
 * Scans a ProseMirror document for straight quotes and returns
 * replacements to convert them to typographic ("smart") quotes.
 *
 * Skips code blocks and inline code marks.
 * Already-smart quotes are left untouched.
 *
 * Quote classification (opening vs. closing) is driven by the preceding
 * character within the same block, threaded across text-node boundaries so
 * that mark splits (e.g. `"*italic*"`) don't reset the context. Block
 * boundaries and non-text inline runs (hardBreak, image, …) do reset it —
 * their single placeholder character is whitespace-equivalent, which the
 * classifiers below treat the same as a hard reset.
 */
export function convertToSmartQuotes(doc: ProseMirrorNode): Replacement[] {
  const replacements: Replacement[] = [];

  for (const block of extractTextBlocks(doc)) {
    let prevChar = "";

    for (const run of block.runs) {
      if (run.kind !== "text") {
        prevChar = run.text;
        continue;
      }

      const text = run.text;
      const marks = run.marks;

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const prev = i > 0 ? text[i - 1] : prevChar;
        const next = i < text.length - 1 ? text[i + 1] : "";
        const absPos = run.from + i;

        if (ch === '"' || ch === "'") {
          // An apostrophe inside a word (don't, it's) always closes, even
          // when the preceding character would otherwise open a quote.
          const isApostrophe =
            ch === "'" && isWordChar(prev) && isWordChar(next);
          const replacement =
            !isApostrophe && isOpeningContext(prev)
              ? SMART_QUOTES[ch].open
              : SMART_QUOTES[ch].close;
          replacements.push({
            from: absPos,
            to: absPos + 1,
            replacement,
            marks,
          });
        }
      }

      prevChar = text[text.length - 1];
    }
  }

  return replacements;
}

function isOpeningContext(prevChar: string): boolean {
  if (prevChar === "") return true;
  // Whitespace or opening punctuation
  return /[\s([{]/.test(prevChar);
}

function isWordChar(ch: string): boolean {
  if (!ch) return false;
  return /\w/.test(ch);
}
