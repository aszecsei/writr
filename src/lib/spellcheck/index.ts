import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type Nspell from "nspell";
import { getCachedFile, setCachedFile } from "./dictionary-cache";
import { extractWords, shouldSkipWord, type WordToken } from "./tokenizer";

export interface SpellcheckResult {
  word: string;
  from: number;
  to: number;
  suggestions: string[];
}

// CDN URLs for English dictionary files
const DICTIONARY_BASE_URL = "https://cdn.jsdelivr.net/npm/dictionary-en@4.0.0";

export class SpellcheckService {
  private nspell: Nspell | null = null;
  private loading = false;
  private loadPromise: Promise<void> | null = null;
  private customWords: Set<string> = new Set();

  async load(): Promise<void> {
    if (this.nspell) return;
    if (this.loadPromise) return this.loadPromise;

    this.loading = true;
    this.loadPromise = this.doLoad();
    await this.loadPromise;
    this.loading = false;
  }

  private async doLoad(): Promise<void> {
    try {
      // Try loading dictionary files from IndexedDB cache first
      const [nspellModule, cachedAff, cachedDic] = await Promise.all([
        import("nspell"),
        getCachedFile("en.aff"),
        getCachedFile("en.dic"),
      ]);

      let aff: string;
      let dic: string;

      if (cachedAff && cachedDic) {
        aff = cachedAff;
        dic = cachedDic;
      } else {
        // Cache miss — fetch from CDN
        const [affResponse, dicResponse] = await Promise.all([
          fetch(`${DICTIONARY_BASE_URL}/index.aff`),
          fetch(`${DICTIONARY_BASE_URL}/index.dic`),
        ]);

        if (!affResponse.ok || !dicResponse.ok) {
          throw new Error("Failed to fetch dictionary files");
        }

        [aff, dic] = await Promise.all([
          affResponse.text(),
          dicResponse.text(),
        ]);

        // Cache for next session (fire-and-forget)
        setCachedFile("en.aff", aff).catch(() => {});
        setCachedFile("en.dic", dic).catch(() => {});
      }

      const nspell = nspellModule.default;
      this.nspell = nspell(aff, dic);
    } catch (error) {
      console.error("Failed to load spellcheck dictionary:", error);
      throw error;
    }
  }

  isLoaded(): boolean {
    return this.nspell !== null;
  }

  isLoading(): boolean {
    return this.loading;
  }

  /**
   * Set custom words that should be considered correct.
   */
  setCustomWords(words: Set<string>): void {
    this.customWords = words;
  }

  /**
   * Check if a single word is spelled correctly.
   */
  isCorrect(word: string): boolean {
    if (!this.nspell) return true;

    const lower = word.toLowerCase();

    // Check custom words first
    if (this.customWords.has(lower)) return true;

    // Check nspell
    return this.nspell.correct(word);
  }

  /**
   * Get spelling suggestions for a word.
   */
  suggest(word: string, limit = 5): string[] {
    if (!this.nspell) return [];
    return this.nspell.suggest(word).slice(0, limit);
  }

  /**
   * Get spelling suggestions for a word (public API for on-demand use).
   * Alias for suggest() — exists as a clear public entry point for lazy suggestion loading.
   */
  getSuggestions(word: string, limit = 5): string[] {
    return this.suggest(word, limit);
  }

  /**
   * Check a ProseMirror document for spelling errors.
   */
  checkDocument(
    doc: ProseMirrorNode,
    ignoredWords?: Set<string>,
  ): SpellcheckResult[] {
    if (!this.nspell) return [];

    const tokens = extractWords(doc);
    const results: SpellcheckResult[] = [];

    for (const token of tokens) {
      if (this.shouldSkip(token.word, ignoredWords)) continue;

      if (!this.isCorrect(token.word)) {
        results.push({
          word: token.word,
          from: token.from,
          to: token.to,
          suggestions: [],
        });
      }
    }

    return results;
  }

  /**
   * Check a subset of text for spelling errors.
   */
  checkText(
    text: string,
    startPos: number,
    ignoredWords?: Set<string>,
  ): SpellcheckResult[] {
    if (!this.nspell) return [];

    const { tokenizeText } = require("./tokenizer");
    const tokens: WordToken[] = tokenizeText(text, startPos);
    const results: SpellcheckResult[] = [];

    for (const token of tokens) {
      if (this.shouldSkip(token.word, ignoredWords)) continue;

      if (!this.isCorrect(token.word)) {
        results.push({
          word: token.word,
          from: token.from,
          to: token.to,
          suggestions: [],
        });
      }
    }

    return results;
  }

  private shouldSkip(word: string, ignoredWords?: Set<string>): boolean {
    const lower = word.toLowerCase();

    // Check ignored words
    if (ignoredWords?.has(lower)) return true;

    // Check common skip conditions
    if (shouldSkipWord(word)) return true;

    return false;
  }
}

// Singleton instance
let instance: SpellcheckService | null = null;

export function getSpellcheckService(): SpellcheckService {
  if (!instance) {
    instance = new SpellcheckService();
  }
  return instance;
}
