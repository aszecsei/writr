import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

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

  doc.descendants((node, pos) => {
    if (node.type.name === "codeBlock") return false;
    if (node.type.name !== "paragraph") return;

    let prevBreakPos = -1;
    node.forEach((child, offset) => {
      const childPos = pos + 1 + offset;
      if (child.type.name === "hardBreak") {
        if (prevBreakPos !== -1) {
          pairs.push({ from: prevBreakPos, to: childPos + child.nodeSize });
          prevBreakPos = -1;
        } else {
          prevBreakPos = childPos;
        }
      } else {
        prevBreakPos = -1;
      }
    });

    return false;
  });

  return pairs;
}
