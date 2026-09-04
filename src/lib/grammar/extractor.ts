import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  extractTextBlocks,
  flattenBlock,
} from "@/lib/prosemirror/extract-text-blocks";

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

  for (const block of extractTextBlocks(doc)) {
    const { text, offsets } = flattenBlock(block);
    if (text.length > 0) {
      blocks.push({ text, offsets });
    }
  }

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
