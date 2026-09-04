import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type Nspell from "nspell";
import { createLazyService } from "@/lib/lazy-service";
import { getCachedFile, setCachedFile } from "./dictionary-cache";
import { extractWords, shouldSkipWord } from "./tokenizer";

export interface SpellcheckResult {
  word: string;
  from: number;
  to: number;
  suggestions: string[];
}

// CDN URLs for English dictionary files
const DICTIONARY_BASE_URL = "https://cdn.jsdelivr.net/npm/dictionary-en@4.0.0";

export class SpellcheckService {
  private lazy = createLazyService(() => this.loadNspell());
  private customWords: Set<string> = new Set();

  async load(): Promise<void> {
    return this.lazy.load();
  }

  private async loadNspell(): Promise<Nspell> {
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
      return nspell(aff, dic);
    } catch (error) {
      console.error("Failed to load spellcheck dictionary:", error);
      throw error;
    }
  }

  isLoaded(): boolean {
    return this.lazy.isLoaded();
  }

  isLoading(): boolean {
    return this.lazy.isLoading();
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
    const nspell = this.lazy.get();
    if (!nspell) return true;

    const lower = word.toLowerCase();

    // Check custom words first
    if (this.customWords.has(lower)) return true;

    // Check nspell
    return nspell.correct(word);
  }

  /**
   * Get spelling suggestions for a word.
   */
  suggest(word: string, limit = 5): string[] {
    const nspell = this.lazy.get();
    if (!nspell) return [];
    return nspell.suggest(word).slice(0, limit);
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
    if (!this.lazy.isLoaded()) return [];

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
