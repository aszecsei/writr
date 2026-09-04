import { MTLD_MIN_TOKENS, MTLD_TTR_THRESHOLD } from "../thresholds";
import type { VocabularyMetrics } from "../types";

/**
 * Type-token ratio and Guiraud's root TTR, computed from a word-frequency
 * map so aggregate scopes can derive them exactly from merged maps.
 */
export function ttrFromFrequency(
  wordFrequency: Readonly<Record<string, number>>,
): Pick<VocabularyMetrics, "ttr" | "rootTtr"> {
  const types = Object.keys(wordFrequency).length;
  const tokens = Object.values(wordFrequency).reduce((sum, n) => sum + n, 0);
  if (tokens === 0) return { ttr: 0, rootTtr: 0 };
  return { ttr: types / tokens, rootTtr: types / Math.sqrt(tokens) };
}

function mtldPass(tokens: readonly string[]): number {
  let factors = 0;
  const seen = new Set<string>();
  let tokenCount = 0;

  for (const token of tokens) {
    seen.add(token);
    tokenCount += 1;
    const ttr = seen.size / tokenCount;
    if (ttr <= MTLD_TTR_THRESHOLD) {
      factors += 1;
      seen.clear();
      tokenCount = 0;
    }
  }

  // Partial final factor, proportional to how far TTR has fallen from 1
  // toward the threshold (standard McCarthy & Jarvis remainder handling).
  if (tokenCount > 0) {
    const ttr = seen.size / tokenCount;
    factors += (1 - ttr) / (1 - MTLD_TTR_THRESHOLD);
  }

  // Fully diverse text never crosses the threshold and leaves a zero
  // partial factor; treat it as one full factor spanning the whole text so
  // MTLD comes out at its ceiling (the token count) instead of dividing by
  // zero.
  return factors === 0 ? tokens.length : tokens.length / factors;
}

/**
 * Measure of Textual Lexical Diversity (McCarthy & Jarvis 2010): average of
 * a forward and a backward pass. Needs token ORDER, so unlike TTR it cannot
 * be recomputed from merged frequency maps — aggregate scopes use a
 * token-weighted average of per-chapter values instead.
 */
export function mtld(tokens: readonly string[]): number | null {
  if (tokens.length < MTLD_MIN_TOKENS) return null;
  const forward = mtldPass(tokens);
  const backward = mtldPass([...tokens].reverse());
  return (forward + backward) / 2;
}
