/**
 * Split text into TTS-sized chunks, preferring natural boundaries.
 *
 * Order of fallbacks per oversized region:
 *   1. paragraph (double-newline) packing — greedy, ≤ maxChars per bucket
 *   2. single newline split (handles editor output that uses lone \n)
 *   3. sentence split (period/?/! followed by whitespace)
 *   4. hard char-window split as a last resort
 *
 * Returns [] for whitespace-only input.
 */
export function chunkTextForTts(text: string, maxChars = 4000): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (maxChars <= 0) {
    throw new Error(
      `chunkTextForTts: maxChars must be positive, got ${maxChars}`,
    );
  }

  const blocks = splitParagraphs(trimmed);
  const chunks: string[] = [];
  let current = "";

  for (const block of blocks) {
    if (block.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (const piece of splitOversized(block, maxChars)) {
        chunks.push(piece);
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      current = block;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function splitOversized(block: string, maxChars: number): string[] {
  // Try single-newline splits first — the editor's textBetween uses '\n' as
  // the block separator, so very long blocks here are usually a single
  // logical paragraph or a run of soft-wrapped lines.
  const byNewline = block
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (byNewline.length > 1) {
    return packPieces(byNewline, maxChars, "\n");
  }

  const bySentence = splitSentences(block);
  if (bySentence.length > 1) {
    return packPieces(bySentence, maxChars, " ");
  }

  return splitByCharWindow(block, maxChars);
}

const SENTENCE_BOUNDARY = /(?<=[.!?])\s+/;

function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_BOUNDARY)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function packPieces(
  pieces: string[],
  maxChars: number,
  joiner: string,
): string[] {
  const out: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (piece.length > maxChars) {
      if (current) {
        out.push(current);
        current = "";
      }
      for (const window of splitByCharWindow(piece, maxChars)) {
        out.push(window);
      }
      continue;
    }
    const candidate = current ? `${current}${joiner}${piece}` : piece;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) out.push(current);
      current = piece;
    }
  }
  if (current) out.push(current);
  return out;
}

function splitByCharWindow(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    out.push(text.slice(i, i + maxChars));
  }
  return out;
}
