import {
  REPEAT_SCORE_EXPONENT,
  REPEAT_SCORE_REFERENCE_TOKENS,
} from "../thresholds";

/** Weight of one redundant copy of `n` words: equals n at the reference length, superlinear beyond it. */
export function repeatWeight(n: number): number {
  const r = REPEAT_SCORE_REFERENCE_TOKENS;
  return r * (n / r) ** REPEAT_SCORE_EXPONENT;
}
