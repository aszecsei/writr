import type { ChapterId } from "@/db/schemas";
import type { TokenizedChapter, WordToken } from "./types";

const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

/**
 * Split text into match-ready words with their source offsets. Deliberately
 * cheap (no NLP): the editor-side passage locator imports this too, and
 * must not pull compromise into the editor bundle.
 */
export function tokenizeText(
  text: string,
): { word: string; start: number; end: number }[] {
  const out: { word: string; start: number; end: number }[] = [];
  for (const match of text.matchAll(WORD_RE)) {
    const start = match.index;
    out.push({
      word: match[0].toLowerCase().replace(/’/g, "'"),
      start,
      end: start + match[0].length,
    });
  }
  return out;
}

/** One continuous token stream for a chapter, so spans can cross paragraphs. */
export function tokenizeChapter(
  chapterId: ChapterId,
  paragraphs: readonly string[],
): TokenizedChapter {
  const tokens: WordToken[] = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    for (const t of tokenizeText(paragraph)) {
      tokens.push({ ...t, paragraphIndex });
    }
  });
  return { chapterId, paragraphs, tokens };
}
