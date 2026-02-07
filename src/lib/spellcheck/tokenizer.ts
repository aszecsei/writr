import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface WordToken {
  word: string;
  from: number;
  to: number;
}

// Patterns to skip
const URL_PATTERN =
  /^(https?:\/\/|www\.)[^\s]+$|^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const NUMBER_PATTERN = /^[\d.,]+$/;

// Characters that should be stripped from word boundaries
const BOUNDARY_CHARS =
  /^[""''„‚«»‹›—–\-:;.,!?()[\]{}<>…]+|[""''„‚«»‹›—–\-:;.,!?()[\]{}<>…]+$/g;

// Smart/curly apostrophes and modifier letter apostrophe → straight apostrophe
const SMART_APOSTROPHES = /[\u2018\u2019\u02BC]/g;

/**
 * Extract words from a ProseMirror document for spellchecking.
 * Returns an array of word tokens with their positions in the document.
 */
export function extractWords(doc: ProseMirrorNode): WordToken[] {
  const words: WordToken[] = [];

  doc.descendants((node, pos) => {
    // Skip code blocks and inline code
    if (node.type.name === "codeBlock" || node.type.name === "code") {
      return false;
    }

    if (node.isText && node.text) {
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
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration pattern
  while ((match = wordPattern.exec(normalized)) !== null) {
    const rawWord = match[0];
    const from = startPos + match.index;
    const to = from + rawWord.length;

    // Clean up boundary characters
    const word = rawWord.replace(BOUNDARY_CHARS, "");
    if (!word) continue;

    // Skip URLs, emails, numbers, and code-like identifiers
    if (URL_PATTERN.test(word)) continue;
    if (NUMBER_PATTERN.test(word)) continue;

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
