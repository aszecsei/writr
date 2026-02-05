import type { Comment } from "@/db/schemas";

export interface ReconcileResult {
  found: boolean;
  newFrom?: number;
  newTo?: number;
  confidence: "exact" | "fuzzy" | "not_found";
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
): ReconcileResult {
  const { fromOffset, toOffset, anchorText } = comment;
  const isPointComment = fromOffset === toOffset;

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
