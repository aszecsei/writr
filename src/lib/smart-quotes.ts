import type { Mark, Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface Replacement {
  from: number;
  to: number;
  replacement: string;
  /** Marks active on the source text node, so the replacement preserves formatting. */
  marks: readonly Mark[];
}

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
 * boundaries and non-text inline nodes (hardBreak, image, …) do reset it.
 */
export function convertToSmartQuotes(doc: ProseMirrorNode): Replacement[] {
  const replacements: Replacement[] = [];
  let prevChar = "";

  doc.descendants((node, pos) => {
    // Skip code blocks entirely
    if (node.type.name === "codeBlock") {
      prevChar = "";
      return false;
    }

    // Entering a new block — the previous block's trailing punctuation must
    // not bleed into this one (e.g. ending one paragraph on `."` shouldn't
    // make the next paragraph's opening `"` look like a closing quote).
    if (node.isBlock) {
      prevChar = "";
      return;
    }

    // Non-text inline node (hardBreak, image, mention, …) — treat as a
    // context break: the character after a line break should be free to open.
    if (!node.isText || !node.text) {
      prevChar = "";
      return;
    }

    // Skip text with inline code mark; don't let code chars leak as context.
    if (node.marks.some((m) => m.type.name === "code")) {
      prevChar = "";
      return;
    }

    const text = node.text;
    const marks = node.marks;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const prev = i > 0 ? text[i - 1] : prevChar;
      const next = i < text.length - 1 ? text[i + 1] : "";
      const absPos = pos + i;

      if (ch === '"') {
        if (isOpeningContext(prev)) {
          replacements.push({
            from: absPos,
            to: absPos + 1,
            replacement: "“",
            marks,
          });
        } else {
          replacements.push({
            from: absPos,
            to: absPos + 1,
            replacement: "”",
            marks,
          });
        }
      } else if (ch === "'") {
        // Apostrophe inside a word (don't, it's)
        if (isWordChar(prev) && isWordChar(next)) {
          replacements.push({
            from: absPos,
            to: absPos + 1,
            replacement: "’",
            marks,
          });
        } else if (isOpeningContext(prev)) {
          replacements.push({
            from: absPos,
            to: absPos + 1,
            replacement: "‘",
            marks,
          });
        } else {
          replacements.push({
            from: absPos,
            to: absPos + 1,
            replacement: "’",
            marks,
          });
        }
      }
    }

    prevChar = text[text.length - 1];
  });

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
