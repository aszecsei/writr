import type { Node as PMNode } from "@tiptap/pm/model";
import type { Comment } from "@/db/schemas";
import { normalizedIndexOf } from "@/lib/punctuation-match";

export interface ReconcileResult {
  found: boolean;
  newFrom?: number;
  newTo?: number;
  confidence: "exact" | "fuzzy" | "not_found";
}

/**
 * Walk a ProseMirror doc and find the PM positions where `anchorText`
 * occurs. Uses the same punctuation normalization the comment tools use to
 * locate text in markdown (`normalizedIndexOf`), so a snippet with straight
 * quotes still finds a doc with curly quotes.
 *
 * Returns the PM `{ from, to }` of the FIRST match within a single text
 * node. Cross-block matches (spanning a paragraph boundary) aren't supported
 * — for those, the search returns null and the caller falls back to the
 * stored offsets. This is acceptable because LLM-emitted anchors almost
 * always sit within a single block.
 */
export function findAnchorPositionInDoc(
  doc: PMNode,
  anchorText: string,
): { from: number; to: number } | null {
  if (!anchorText) return null;

  // Build a flat string of text content and a parallel array of PM
  // positions: positions[i] is the PM position immediately BEFORE the i-th
  // character in the flat string. A selection {from: positions[i], to:
  // positions[i] + L} highlights flat[i..i+L) within a single text node.
  // We descend block-by-block and DON'T concatenate across block
  // boundaries, so matches can't span paragraphs (PM positions between
  // text nodes carry node-boundary gaps that would break the
  // contiguous-positions assumption).
  let foundFrom: number | null = null;
  let foundTo: number | null = null;

  doc.descendants((node, pos) => {
    if (foundFrom !== null) return false;
    if (!node.isText || !node.text) return true;

    const text = node.text;
    const idx = normalizedIndexOf(text, anchorText);
    if (idx >= 0) {
      foundFrom = pos + idx;
      foundTo = pos + idx + anchorText.length;
      return false;
    }
    return false; // text nodes have no children to descend into
  });

  if (foundFrom === null || foundTo === null) return null;
  return { from: foundFrom, to: foundTo };
}

/**
 * Reconciles a comment's position against the current document plain text.
 * Offsets are ProseMirror positions stored from the last session.
 * We convert to plain text offsets for matching, then map back.
 *
 * `plainText` is the full document text extracted via doc.textBetween(1, doc.content.size).
 * The positions stored in comments are ProseMirror positions (starting at 1 for doc start).
 *
 * Since ProseMirror positions include node boundaries, and the plain text has those
 * stripped out, we can't do a perfect 1:1 mapping. Instead, we use anchor text as
 * the source of truth. If the text at the stored position doesn't match,
 * we search for it in the document.
 */
export function reconcileComment(
  comment: Comment,
  plainText: string,
  doc?: PMNode,
): ReconcileResult {
  const { fromOffset, toOffset, anchorText } = comment;
  const isPointComment = fromOffset === toOffset;

  // Doc-aware path: when the live PM doc is supplied, we can recover true
  // PM positions for range comments with a stored anchor — including those
  // created by the AI `add_comment` tool without an editor open, which
  // writes a placeholder offset and relies on this lookup to land the
  // highlight in the right place. Falls through to the plain-text path
  // when the doc is absent or the anchor can't be located there.
  if (doc && !isPointComment && anchorText && !anchorText.includes("...")) {
    const located = findAnchorPositionInDoc(doc, anchorText);
    if (located) {
      const samePos = located.from === fromOffset && located.to === toOffset;
      return samePos
        ? { found: true, confidence: "exact" }
        : {
            found: true,
            newFrom: located.from,
            newTo: located.to,
            confidence: "fuzzy",
          };
    }
  }

  // Point comments without anchor text - just clamp to text length
  if (isPointComment && !anchorText) {
    if (fromOffset <= plainText.length + 1) {
      return { found: true, confidence: "exact" };
    }
    return {
      found: true,
      newFrom: Math.min(fromOffset, plainText.length + 1),
      newTo: Math.min(toOffset, plainText.length + 1),
      confidence: "fuzzy",
    };
  }

  // For range comments with anchor text - search for the text
  if (!isPointComment && anchorText && !anchorText.includes("...")) {
    // Try to find anchor text at approximately the same position in plainText
    // Since PM positions don't map 1:1 to plainText indices, we do a text search

    // First check if the anchor appears near the expected location
    const searchWindow = Math.max(anchorText.length * 3, 200);
    const approxIndex = Math.max(0, fromOffset - searchWindow);
    const searchEnd = Math.min(plainText.length, toOffset + searchWindow);
    const searchRegion = plainText.slice(approxIndex, searchEnd);

    const idx = searchRegion.indexOf(anchorText);
    if (idx !== -1) {
      // Found it - but we can't reliably convert plainText indices back to PM positions
      // So return "exact" confidence if it's near enough, indicating no update needed
      return { found: true, confidence: "exact" };
    }

    // Search the entire document
    const globalIdx = plainText.indexOf(anchorText);
    if (globalIdx !== -1) {
      // Found elsewhere - we can't easily convert back to PM positions, mark as fuzzy
      return { found: true, confidence: "fuzzy" };
    }

    // Not found at all
    return { found: false, confidence: "not_found" };
  }

  // Point comment with context anchor text
  if (isPointComment && anchorText) {
    const idx = plainText.indexOf(anchorText);
    if (idx !== -1) {
      return { found: true, confidence: "exact" };
    }
    // Context drifted, keep at current position
    return { found: true, confidence: "fuzzy" };
  }

  // Range comment without anchor text or with truncated anchor - just validate bounds
  if (fromOffset <= plainText.length + 1 && toOffset <= plainText.length + 1) {
    return { found: true, confidence: "exact" };
  }

  return {
    found: true,
    newFrom: Math.min(fromOffset, plainText.length + 1),
    newTo: Math.min(toOffset, plainText.length + 1),
    confidence: "fuzzy",
  };
}
