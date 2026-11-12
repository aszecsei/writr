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

// ─── Repeated passages (`repeats/`) ─────────────────────────────────

/** Words per shingle: the shortest verbatim run that can seed a match. */
export const REPEAT_SHINGLE_TOKENS = 5;

/**
 * Unmatched words tolerated on either side between two verbatim runs
 * before a match is split in two. Covers a substitution and an insertion
 * a couple of words apart.
 */
export const REPEAT_MAX_GAP_TOKENS = 6;

/** Max difference between the two sides' gaps (net inserted/deleted words). */
export const REPEAT_MAX_SKEW_TOKENS = 3;

/**
 * Each occurrence of a shingle is paired with at most this many earlier
 * occurrences, keeping seed count linear for refrains repeated hundreds of
 * times. Union-find still joins every copy into one cluster.
 */
export const REPEAT_SEED_NEIGHBOR_WINDOW = 8;

/** A repeat must share at least this many words to be reported. */
export const REPEAT_MIN_MATCHED_TOKENS = 8;

/** ...and contain at least this many non-glue words, so filler doesn't count. */
export const REPEAT_MIN_CONTENT_TOKENS = 3;

/**
 * Two copies within one chapter must be at least this many words apart;
 * closer repetition is deliberate rhetoric (anaphora) or an echo, which
 * the word-echo metric already covers.
 */
export const REPEAT_MIN_SELF_DISTANCE_TOKENS = 60;

/**
 * Spans overlapping by this share of the longer one are the same location.
 * Measured against the longer span so a short phrase that a longer match
 * happens to run into stays a separate location (and cluster).
 */
export const REPEAT_LOCATION_MERGE_OVERLAP = 0.5;

/**
 * Cluster score is Σ R·(n/R)^E over each copy's redundant words n, so a
 * copy of R words scores R and longer copies score superlinearly. Short
 * phrasal tics don't outrank a recycled paragraph.
 */
export const REPEAT_SCORE_REFERENCE_TOKENS = 10;
export const REPEAT_SCORE_EXPONENT = 1.5;

/** Max clusters `findRepeatedPassages` returns. */
export const REPEAT_CLUSTER_LIMIT = 100;

/**
 * When an exact passage can't be found in the editor (it was edited after
 * the run), fall back to locating its first this-many words.
 */
export const PASSAGE_PROBE_TOKENS = 8;
