export interface ChunkOptions {
  maxWords?: number;
  overlapWords?: number;
}

const SEPARATOR_RE = /^(?:\*\s*\*\s*\*[\s*]*|-{3,}|_{3,}|#{1,6}\s*)$/;

function wordsOf(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

function hardSplit(
  paragraph: string,
  maxWords: number,
  overlap: number,
): string[] {
  const all = wordsOf(paragraph);
  const out: string[] = [];
  const step = Math.max(1, maxWords - overlap);
  for (let i = 0; i < all.length; i += step) {
    out.push(all.slice(i, i + maxWords).join(" "));
    if (i + maxWords >= all.length) break;
  }
  return out;
}

/**
 * Split markdown into word-bounded, slightly overlapping chunks suitable for
 * embedding.
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const maxWords = options.maxWords ?? 180;
  const overlapWords = options.overlapWords ?? 30;

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  let current: string[] = [];
  let currentCount = 0;

  const flush = () => {
    if (current.length === 0) return;
    const chunk = current.join("\n\n");
    chunks.push(chunk);
    // Seed the next chunk with the trailing overlap words of this one.
    const tail = overlapWords > 0 ? wordsOf(chunk).slice(-overlapWords) : [];
    current = tail.length > 0 ? [tail.join(" ")] : [];
    currentCount = tail.length;
  };

  for (const para of paragraphs) {
    if (SEPARATOR_RE.test(para)) {
      flush();
      current = [];
      currentCount = 0;
      continue;
    }
    const count = wordsOf(para).length;
    if (count > maxWords) {
      flush();
      current = [];
      currentCount = 0;
      for (const piece of hardSplit(para, maxWords, overlapWords)) {
        chunks.push(piece);
      }
      continue;
    }
    if (currentCount + count > maxWords && current.length > 0) {
      flush();
    }
    current.push(para);
    currentCount += count;
  }
  flush();

  // The overlap-seed logic can leave a final chunk that is pure overlap; drop
  // any trailing chunk that duplicates the tail of the previous one.
  return chunks.filter((c, i) => i === 0 || c !== chunks[i - 1]);
}
