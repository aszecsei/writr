import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { findHoles, type HoleDelimiters } from "@/lib/holes";
import { tokenizeText } from "@/lib/text-analysis/repeats/tokenize";
import type { PassageAnchor } from "@/lib/text-analysis/repeats/types";
import { PASSAGE_PROBE_TOKENS } from "@/lib/text-analysis/thresholds";
import { extractTextBlocks, flattenBlock } from "./extract-text-blocks";

interface DocToken {
  word: string;
  from: number;
  to: number;
}

/**
 * The doc's words as one stream, reduced the same way the analysis reduces
 * markdown (headings skipped, holes removed without a gap), each carrying
 * its ProseMirror range.
 */
function docTokens(
  doc: ProseMirrorNode,
  delimiters: HoleDelimiters,
): DocToken[] {
  const out: DocToken[] = [];
  for (const block of extractTextBlocks(doc)) {
    if (block.node.type.name === "heading") continue;
    const { text, offsets } = flattenBlock(block);

    let kept = "";
    const keptOffsets: number[] = [];
    let cursor = 0;
    const keep = (until: number) => {
      kept += text.slice(cursor, until);
      for (let i = cursor; i < until; i++) keptOffsets.push(offsets[i]);
    };
    for (const hole of findHoles(text, delimiters)) {
      keep(hole.index);
      cursor = hole.index + hole.length;
    }
    keep(text.length);

    for (const t of tokenizeText(kept)) {
      out.push({
        word: t.word,
        from: keptOffsets[t.start],
        to: keptOffsets[t.end - 1] + 1,
      });
    }
  }
  return out;
}

function matchStarts(
  tokens: readonly DocToken[],
  words: readonly string[],
): number[] {
  const starts: number[] = [];
  outer: for (let i = 0; i + words.length <= tokens.length; i++) {
    for (let k = 0; k < words.length; k++) {
      if (tokens[i + k].word !== words[k]) continue outer;
    }
    starts.push(i);
  }
  return starts;
}

/**
 * Find a repeated-passage anchor in the live doc by word sequence, which
 * survives mark boundaries and paragraph breaks that character offsets
 * don't. Picks the anchor's occurrence among identical sequences (clamped),
 * and falls back to the passage's opening words if it was edited since.
 */
export function locatePassageInDoc(
  doc: ProseMirrorNode,
  anchor: PassageAnchor,
  delimiters: HoleDelimiters,
): { from: number; to: number } | null {
  if (anchor.tokens.length === 0) return null;
  const tokens = docTokens(doc, delimiters);
  const attempt = (words: readonly string[]) => {
    const starts = matchStarts(tokens, words);
    if (starts.length === 0) return null;
    const start = starts[Math.min(anchor.occurrence, starts.length - 1)];
    return {
      from: tokens[start].from,
      to: tokens[start + words.length - 1].to,
    };
  };
  return (
    attempt(anchor.tokens) ??
    (anchor.tokens.length > PASSAGE_PROBE_TOKENS
      ? attempt(anchor.tokens.slice(0, PASSAGE_PROBE_TOKENS))
      : null)
  );
}
