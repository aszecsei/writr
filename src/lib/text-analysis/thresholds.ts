/**
 * Numeric knobs for the analysis metrics and their banding helpers
 * (`presentation.ts`), collected in one place so tuning them doesn't require
 * hunting across the metric modules.
 */

/** Two uses of a word within this many sentences read as an echo. */
export const ECHO_WINDOW_SENTENCES = 5;

/** Max rows `topContentWords` returns. */
export const TOP_WORDS_LIMIT = 20;

/** Max rows `detectEchoes` returns. */
export const ECHO_LIMIT = 50;

/** A sentence is "sticky" above this share of glue words. */
export const STICKY_THRESHOLD = 0.6;

/** Very short sentences are all glue by nature; don't flag them. */
export const STICKY_MIN_WORDS = 8;

/**
 * Average-sentence-length breakpoints between paragraph-density levels: a
 * paragraph of short, punchy sentences reads light (0); long winding
 * sentences read dense (4). Words-per-paragraph already has its own stat
 * row, so density deliberately measures sentence length, not paragraph bulk.
 */
export const DENSITY_BREAKPOINTS = [8, 14, 20, 26] as const;

/** Word-count boundaries for the short/medium/long/veryLong sentence buckets. */
export const SHORT_MAX = 7;
export const MEDIUM_MAX = 19;
export const LONG_MAX = 29;

/** MTLD is unstable below this many tokens; report null instead. */
export const MTLD_MIN_TOKENS = 50;

/** The TTR level at which an MTLD factor is considered complete. */
export const MTLD_TTR_THRESHOLD = 0.72;
