import type { AnalyzedSentence, AnalyzedTerm, Echo, WordCount } from "../types";
import { STOPWORDS } from "../word-lists";
import { makeExcerpt } from "./glue";

/** Two uses of a word within this many sentences read as an echo. */
export const ECHO_WINDOW_SENTENCES = 5;

const TOP_WORDS_LIMIT = 20;
const ECHO_LIMIT = 50;

function isContentWord(normal: string): boolean {
  return normal.length > 2 && !STOPWORDS.has(normal) && !/\d/.test(normal);
}

/**
 * compromise tags names by context: a surname is a ProperNoun mid-sentence but
 * a bare Noun at sentence start, where capitalization is ambiguous. Treating a
 * normal as a name when ANY occurrence carries one of these tags exempts the
 * whole name, including the occurrences compromise under-tagged.
 */
const NAME_TAGS = ["ProperNoun", "Person", "Place", "Organization"];

function isProperName(term: AnalyzedTerm): boolean {
  return NAME_TAGS.some((tag) => term.tags.has(tag));
}

/** Top content words from a word-frequency map (works at every scope). */
export function topContentWords(
  wordFrequency: Readonly<Record<string, number>>,
  limit = TOP_WORDS_LIMIT,
): WordCount[] {
  return Object.entries(wordFrequency)
    .filter(([word]) => isContentWord(word))
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit);
}

/**
 * Echoes: a content word repeated within ECHO_WINDOW_SENTENCES of its
 * previous use — close enough that a reader hears the repetition. Proper
 * nouns are exempt; character and place names legitimately recur.
 */
export function detectEchoes(sentences: readonly AnalyzedSentence[]): Echo[] {
  // First pass: every normal flagged as a name anywhere in the chapter, so a
  // recurring character or place is exempt even in sentences where compromise
  // failed to tag it (e.g. at sentence start).
  // Key echoes on the lemma so inflections read as one word ("wonder" /
  // "wonders") and singular/plural pairs collapse. Names are exempt by their
  // lemma too, kept consistent with the membership checks below.
  const properNames = new Set<string>();
  for (const sentence of sentences) {
    for (const term of sentence.terms) {
      if (isProperName(term)) properNames.add(term.root);
    }
  }

  const occurrences = new Map<
    string,
    { sentenceIndex: number; text: string }[]
  >();

  sentences.forEach((sentence, sentenceIndex) => {
    const seenInSentence = new Set<string>();
    for (const term of sentence.terms) {
      if (!isContentWord(term.root) || properNames.has(term.root)) continue;
      // Record one occurrence per sentence; same-sentence repeats still
      // count as one hit at this index, and the window check below pairs
      // them with neighbors.
      if (seenInSentence.has(term.root)) continue;
      seenInSentence.add(term.root);
      const list = occurrences.get(term.root) ?? [];
      list.push({ sentenceIndex, text: sentence.text });
      occurrences.set(term.root, list);
    }
  });

  const echoes: Echo[] = [];
  for (const [word, hits] of occurrences) {
    if (hits.length < 2) continue;
    // Group consecutive hits that fall within the window of each other.
    let group: typeof hits = [hits[0]];
    const groups: (typeof hits)[] = [];
    for (let i = 1; i < hits.length; i++) {
      if (
        hits[i].sentenceIndex - group[group.length - 1].sentenceIndex <=
        ECHO_WINDOW_SENTENCES
      ) {
        group.push(hits[i]);
      } else {
        groups.push(group);
        group = [hits[i]];
      }
    }
    groups.push(group);

    const echoed = groups.filter((g) => g.length >= 2);
    if (echoed.length === 0) continue;
    // A word may echo in several distant places; each qualifying cluster is a
    // separate echo. Surface one row per word, representing its densest
    // cluster — most occurrences, then tightest spacing — rather than merging
    // clusters, which would inflate the count and span the gap between them.
    const densest = echoed.reduce((best, group) => {
      if (group.length !== best.length) {
        return group.length > best.length ? group : best;
      }
      const span =
        group[group.length - 1].sentenceIndex - group[0].sentenceIndex;
      const bestSpan =
        best[best.length - 1].sentenceIndex - best[0].sentenceIndex;
      return span < bestSpan ? group : best;
    });
    echoes.push({
      word,
      count: densest.length,
      occurrences: densest.map((hit) => ({
        sentenceIndex: hit.sentenceIndex,
        excerpt: makeExcerpt(hit.text),
      })),
    });
  }

  return echoes
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, ECHO_LIMIT);
}

export type EchoSeverity = "dense" | "echo";

export interface EchoProximity {
  /** Smallest sentence gap between consecutive occurrences. 0 = same sentence. */
  minGap: number;
  /** Largest sentence gap between consecutive occurrences. */
  maxGap: number;
}

/** Sentence gaps between consecutive occurrences of an echo. */
export function echoProximity(echo: Echo): EchoProximity {
  if (echo.occurrences.length < 2) {
    throw new Error(
      `echoProximity expects an echo with at least 2 occurrences; "${echo.word}" has ${echo.occurrences.length}`,
    );
  }
  let minGap = Number.POSITIVE_INFINITY;
  let maxGap = 0;
  for (let i = 1; i < echo.occurrences.length; i++) {
    const gap =
      echo.occurrences[i].sentenceIndex - echo.occurrences[i - 1].sentenceIndex;
    minGap = Math.min(minGap, gap);
    maxGap = Math.max(maxGap, gap);
  }
  return { minGap, maxGap };
}

/**
 * Dense echoes repeat often (4+) or pile up in adjacent sentences (3+ with
 * back-to-back uses); everything else detected is an ordinary echo.
 */
export function echoSeverity(echo: Echo): EchoSeverity {
  if (echo.count >= 4) return "dense";
  if (echo.count >= 3 && echoProximity(echo).minGap <= 1) return "dense";
  return "echo";
}
