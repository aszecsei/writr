import type { Mark, Node as ProseMirrorNode } from "@tiptap/pm/model";

export type InlineRunKind = "text" | "code" | "hardBreak" | "atom";

/**
 * One contiguous piece of a textblock's inline content, corresponding to a
 * single child node. Non-text children (hardBreak, other inline atoms) and
 * inline-code text are collapsed to a single placeholder character so they
 * still act as word/context boundaries for consumers that flatten runs into
 * a plain string.
 */
export interface InlineRun {
  kind: InlineRunKind;
  /** Real text for "text" runs; a single placeholder character otherwise
   * ("\n" for hardBreak, " " for code and other atoms). */
  text: string;
  /** Absolute ProseMirror position of the run's first character. */
  from: number;
  /** Marks active on the source text node; empty for synthesized runs. */
  marks: readonly Mark[];
}

export interface TextBlock {
  node: ProseMirrorNode;
  pos: number;
  runs: InlineRun[];
}

/**
 * Walk a ProseMirror document and collect one {@link TextBlock} per
 * textblock (paragraph, heading, screenplay line, …), each broken into
 * per-child {@link InlineRun}s. Code blocks are skipped entirely; inline
 * code marks are collapsed to a single space so they still separate
 * surrounding words without exposing their content.
 */
export function extractTextBlocks(doc: ProseMirrorNode): TextBlock[] {
  const blocks: TextBlock[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name === "codeBlock") {
      return false;
    }

    if (!node.isTextblock) {
      return true;
    }

    const runs: InlineRun[] = [];
    const contentStart = pos + 1;

    node.forEach((child, offset) => {
      const childStart = contentStart + offset;

      if (child.isText && child.text) {
        if (child.marks.some((mark) => mark.type.name === "code")) {
          runs.push({ kind: "code", text: " ", from: childStart, marks: [] });
          return;
        }
        runs.push({
          kind: "text",
          text: child.text,
          from: childStart,
          marks: child.marks,
        });
        return;
      }

      if (child.type.name === "hardBreak") {
        runs.push({
          kind: "hardBreak",
          text: "\n",
          from: childStart,
          marks: [],
        });
        return;
      }

      runs.push({ kind: "atom", text: " ", from: childStart, marks: [] });
    });

    blocks.push({ node, pos, runs });

    return false;
  });

  return blocks;
}

/**
 * Flatten a block's runs into a single string with a parallel per-character
 * offsets array, so `offsets[i]` is the ProseMirror position of `text[i]`.
 */
export function flattenBlock(block: TextBlock): {
  text: string;
  offsets: number[];
} {
  const chars: string[] = [];
  const offsets: number[] = [];

  for (const run of block.runs) {
    for (let k = 0; k < run.text.length; k++) {
      chars.push(run.text[k]);
      offsets.push(run.from + k);
    }
  }

  return { text: chars.join(""), offsets };
}
