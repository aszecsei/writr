import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { extractTextBlocks } from "@/lib/prosemirror/extract-text-blocks";

export interface LineBreakPair {
  /** Position of the first hardBreak in the pair (inclusive). */
  from: number;
  /** Position immediately after the second hardBreak in the pair (exclusive). */
  to: number;
}

/**
 * Scans a ProseMirror document for pairs of consecutive `hardBreak` nodes
 * inside paragraphs and returns each pair's position range.
 *
 * Pairs are consumed non-overlapping, left to right: a run of N consecutive
 * hardBreaks produces floor(N / 2) pairs, leaving a trailing hardBreak when
 * N is odd. Headings and code blocks are skipped.
 */
export function findLineBreakPairs(doc: ProseMirrorNode): LineBreakPair[] {
  const pairs: LineBreakPair[] = [];

  for (const block of extractTextBlocks(doc)) {
    if (block.node.type.name !== "paragraph") continue;

    let prevBreakPos = -1;
    for (const run of block.runs) {
      if (run.kind === "hardBreak") {
        if (prevBreakPos !== -1) {
          pairs.push({ from: prevBreakPos, to: run.from + 1 });
          prevBreakPos = -1;
        } else {
          prevBreakPos = run.from;
        }
      } else {
        prevBreakPos = -1;
      }
    }
  }

  return pairs;
}
