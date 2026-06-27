import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/**
 * A block of prose extracted from a ProseMirror document, ready to hand to
 * harper for grammar checking.
 *
 * Grammar checking needs continuous text (it reasons across whole sentences),
 * unlike spellcheck which works one word at a time. We therefore extract each
 * textblock's inline text into a single string and keep a parallel `offsets`
 * array so harper's character spans can be mapped back to ProseMirror positions.
 */
export interface GrammarBlock {
  /** The block's inline text, concatenated from its text nodes. */
  text: string;
  /**
   * `offsets[i]` is the ProseMirror position of the character at `text[i]`,
   * so `offsets.length === text.length`. ProseMirror measures text in UTF-16
   * code units, and this array is built per code unit — the same convention
   * the spellcheck tokenizer uses. Astral characters (rare in prose) can
   * misalign with harper's code-point span indices; accepted as an edge case.
   */
  offsets: number[];
}

/**
 * Walk a ProseMirror document and extract one {@link GrammarBlock} per
 * textblock (paragraph, heading, screenplay line, …). Code blocks and inline
 * code are excluded — they aren't prose and would produce noise.
 */
export function extractBlocks(doc: ProseMirrorNode): GrammarBlock[] {
  const blocks: GrammarBlock[] = [];

  doc.descendants((node, pos) => {
    // Code blocks are not prose — skip the whole subtree.
    if (node.type.name === "codeBlock") {
      return false;
    }

    // Descend into containers (doc, blockquote, list items) until we reach a
    // leaf textblock whose inline content we can read directly.
    if (!node.isTextblock) {
      return true;
    }

    const chars: string[] = [];
    const offsets: number[] = [];
    // A textblock's inline content begins one position after the node itself.
    const contentStart = pos + 1;

    node.forEach((child, offset) => {
      const childStart = contentStart + offset;

      if (child.isText && child.text) {
        // Inline code is not prose; replace with a single space so it still
        // acts as a word boundary without polluting the grammar check.
        if (child.marks.some((mark) => mark.type.name === "code")) {
          chars.push(" ");
          offsets.push(childStart);
          return;
        }
        for (let k = 0; k < child.text.length; k++) {
          chars.push(child.text[k]);
          offsets.push(childStart + k);
        }
        return;
      }

      // Hard breaks become newlines; other inline atoms (e.g. inline images)
      // become a space. Either way the mapped position points at the atom.
      chars.push(child.type.name === "hardBreak" ? "\n" : " ");
      offsets.push(childStart);
    });

    if (chars.length > 0) {
      blocks.push({ text: chars.join(""), offsets });
    }

    // We've consumed this textblock's inline content; don't descend again.
    return false;
  });

  return blocks;
}

/**
 * Map a harper character span (`[start, end)` into `block.text`) to a
 * ProseMirror `{ from, to }` range. Returns `null` for empty or out-of-range
 * spans so callers can skip them rather than produce a bad decoration.
 */
export function mapSpanToRange(
  block: GrammarBlock,
  start: number,
  end: number,
): { from: number; to: number } | null {
  if (start < 0 || end <= start || end > block.offsets.length) {
    return null;
  }
  return {
    from: block.offsets[start],
    to: block.offsets[end - 1] + 1,
  };
}
