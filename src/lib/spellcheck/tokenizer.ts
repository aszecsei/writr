import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface WordToken {
  word: string;
  from: number;
  to: number;
}

// Smart/curly apostrophes and modifier letter apostrophe → straight apostrophe
const SMART_APOSTROPHES = /[‘’ʼ]/g;

/**
 * Extract words from a ProseMirror document for spellchecking.
 * Returns an array of word tokens with their positions in the document.
 */
export function extractWords(doc: ProseMirrorNode): WordToken[] {
  const words: WordToken[] = [];

  doc.descendants((node, pos) => {
    // Skip code blocks
    if (node.type.name === "codeBlock") {
      return false;
    }

    if (node.isText && node.text) {
      if (node.marks.some((mark) => mark.type.name === "code")) {
        return true;
      }
      const tokens = tokenizeText(node.text, pos);
      words.push(...tokens);
    }

    return true;
  });

  return words;
}

/**
 * Tokenize a text string into words with their positions.
 */
export function tokenizeText(text: string, startPos: number): WordToken[] {
  const tokens: WordToken[] = [];
  const normalized = text.replace(SMART_APOSTROPHES, "'");

  // Match word-like sequences including contractions
  const wordPattern = /[\p{L}\p{M}]+(?:'[\p{L}\p{M}]+)*/gu;

  for (const match of normalized.matchAll(wordPattern)) {
    const word = match[0];
    const from = startPos + match.index;
    const to = from + word.length;

    // Skip very short words (likely abbreviations or typos)
    if (word.length < 2) continue;

    tokens.push({ word, from, to });
  }

  return tokens;
}

/**
 * Check if a word looks like it should be skipped (proper noun, abbreviation, etc.)
 */
export function shouldSkipWord(word: string): boolean {
  // All caps words (abbreviations like "NASA", "FBI")
  if (word === word.toUpperCase() && word.length <= 5) {
    return true;
  }

  // Ordinals like "1st", "2nd", "3rd"
  if (/^\d+(st|nd|rd|th)$/i.test(word)) {
    return true;
  }

  return false;
}
