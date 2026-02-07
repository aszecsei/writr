import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

interface Replacement {
  from: number;
  to: number;
  replacement: string;
}

/**
 * Scans a ProseMirror document for straight quotes and returns
 * replacements to convert them to typographic ("smart") quotes.
 *
 * Skips code blocks and inline code marks.
 * Already-smart quotes are left untouched.
 */
export function convertToSmartQuotes(doc: ProseMirrorNode): Replacement[] {
  const replacements: Replacement[] = [];

  doc.descendants((node, pos) => {
    // Skip code blocks entirely
    if (node.type.name === "codeBlock") return false;

    if (!node.isText || !node.text) return;

    // Skip text with code mark
    if (node.marks.some((m) => m.type.name === "code")) return;

    const text = node.text;
    // pos is the position before the node; text starts at pos itself for text nodes
    // within their parent. Actually, for descendants, pos is the offset of the
    // node's start in the document.
    const basePos = pos;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const prevChar = i > 0 ? text[i - 1] : "";
      const nextChar = i < text.length - 1 ? text[i + 1] : "";
      const absPos = basePos + i;

      if (ch === '"') {
        // Left double quote: after whitespace, start of text, or opening punctuation
        if (isOpeningContext(prevChar, i === 0)) {
          replacements.push({
            from: absPos,
            to: absPos + 1,
            replacement: "\u201C",
          });
        } else {
          // Right double quote
          replacements.push({
            from: absPos,
            to: absPos + 1,
            replacement: "\u201D",
          });
        }
      } else if (ch === "'") {
        // Apostrophe: between word characters (e.g. don't, it's)
        if (isWordChar(prevChar) && isWordChar(nextChar)) {
          replacements.push({
            from: absPos,
            to: absPos + 1,
            replacement: "\u2019",
          });
        } else if (isOpeningContext(prevChar, i === 0)) {
          // Left single quote
          replacements.push({
            from: absPos,
            to: absPos + 1,
            replacement: "\u2018",
          });
        } else {
          // Right single quote / apostrophe
          replacements.push({
            from: absPos,
            to: absPos + 1,
            replacement: "\u2019",
          });
        }
      }
    }
  });

  return replacements;
}

function isOpeningContext(prevChar: string, isStart: boolean): boolean {
  if (isStart || prevChar === "") return true;
  // Whitespace or opening punctuation
  return /[\s([{]/.test(prevChar);
}

function isWordChar(ch: string): boolean {
  if (!ch) return false;
  return /\w/.test(ch);
}
