import { makeExcerpt } from "../excerpt";
import {
  REPEAT_CLUSTER_LIMIT,
  REPEAT_LOCATION_MERGE_OVERLAP,
  REPEAT_MAX_GAP_TOKENS,
  REPEAT_MAX_SKEW_TOKENS,
  REPEAT_MIN_CONTENT_TOKENS,
  REPEAT_MIN_MATCHED_TOKENS,
  REPEAT_MIN_SELF_DISTANCE_TOKENS,
  REPEAT_SEED_NEIGHBOR_WINDOW,
  REPEAT_SHINGLE_TOKENS,
} from "../thresholds";
import { GLUE_WORDS } from "../word-lists";
import { repeatWeight } from "./score";
import type {
  RepeatCluster,
  RepeatMember,
  RepeatReport,
  TokenizedChapter,
} from "./types";

const K = REPEAT_SHINGLE_TOKENS;
const SKEW = REPEAT_MAX_SKEW_TOKENS;
const CANCEL_CHECK_INTERVAL = 4096;

/**
 * All chapters concatenated into one global token stream. Global positions
 * increase in reading order, so "a < b" means "a is read first".
 */
interface Corpus {
  ids: Int32Array;
  doc: Int32Array;
  /** contentPrefix[i] = number of non-glue tokens before global position i. */
  contentPrefix: Int32Array;
  docStart: number[];
  docEnd: number[];
}

function buildCorpus(chapters: readonly TokenizedChapter[]): Corpus {
  let total = 0;
  for (const ch of chapters) total += ch.tokens.length;
  const ids = new Int32Array(total);
  const doc = new Int32Array(total);
  const contentPrefix = new Int32Array(total + 1);
  const docStart: number[] = [];
  const docEnd: number[] = [];
  const wordIds = new Map<string, number>();
  let pos = 0;
  chapters.forEach((ch, d) => {
    docStart.push(pos);
    for (const token of ch.tokens) {
      let id = wordIds.get(token.word);
      if (id === undefined) {
        id = wordIds.size;
        wordIds.set(token.word, id);
      }
      ids[pos] = id;
      doc[pos] = d;
      contentPrefix[pos + 1] =
        contentPrefix[pos] + (GLUE_WORDS.has(token.word) ? 0 : 1);
      pos++;
    }
    docEnd.push(pos);
  });
  return { ids, doc, contentPrefix, docStart, docEnd };
}

function contentCount(corpus: Corpus, start: number, end: number): number {
  return corpus.contentPrefix[end] - corpus.contentPrefix[start];
}

function shingleHash(ids: Int32Array, start: number): number {
  let h = 2166136261;
  for (let i = start; i < start + K; i++) {
    h ^= ids[i];
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function sameRun(
  ids: Int32Array,
  a: number,
  b: number,
  length: number,
): boolean {
  for (let i = 0; i < length; i++) if (ids[a + i] !== ids[b + i]) return false;
  return true;
}

/**
 * Posting lists of every shingle with at least one content word, in reading
 * order. Glue-only shingles ("and then he said that") can't start a match.
 */
function indexShingles(corpus: Corpus): Map<number, number[]> {
  const postings = new Map<number, number[]>();
  for (let d = 0; d < corpus.docStart.length; d++) {
    for (let i = corpus.docStart[d]; i + K <= corpus.docEnd[d]; i++) {
      if (contentCount(corpus, i, i + K) === 0) continue;
      const h = shingleHash(corpus.ids, i);
      const list = postings.get(h);
      if (list) list.push(i);
      else postings.set(h, [i]);
    }
  }
  return postings;
}

function generateSeeds(
  corpus: Corpus,
  postings: Map<number, number[]>,
): [number, number][] {
  const seeds: [number, number][] = [];
  for (const list of postings.values()) {
    for (let i = 1; i < list.length; i++) {
      const b = list[i];
      for (let j = Math.max(0, i - REPEAT_SEED_NEIGHBOR_WINDOW); j < i; j++) {
        const a = list[j];
        if (!sameRun(corpus.ids, a, b, K)) continue;
        if (
          corpus.doc[a] === corpus.doc[b] &&
          b - a < REPEAT_MIN_SELF_DISTANCE_TOKENS
        ) {
          continue;
        }
        seeds.push([a, b]);
      }
    }
  }
  seeds.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  return seeds;
}

interface Chain {
  startA: number;
  startB: number;
  lastA: number;
  lastB: number;
  /** Tokens covered by the union of the chain's seed windows, per side. */
  covA: number;
  covB: number;
}

/**
 * Seed-and-extend: chain seeds running roughly along one diagonal. A
 * one-word substitution between verbatim runs steps both sides by K+1; g
 * inserted words skew the two steps by g. Steps may reach K + the max gap
 * on each side and differ by at most the max skew.
 */
function chainSeeds(
  corpus: Corpus,
  seeds: readonly [number, number][],
  isCancelled: () => boolean,
): Chain[] | null {
  const chains: Chain[] = [];
  const active = new Map<number, Chain[]>();
  const reach = K + REPEAT_MAX_GAP_TOKENS;

  for (let s = 0; s < seeds.length; s++) {
    if (s % CANCEL_CHECK_INTERVAL === 0 && isCancelled()) return null;
    const [a, b] = seeds[s];
    const d = b - a;

    let best: Chain | null = null;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let dd = d - SKEW; dd <= d + SKEW; dd++) {
      const list = active.get(dd);
      if (!list) continue;
      for (let k = list.length - 1; k >= 0; k--) {
        const c = list[k];
        if (c.lastA < a - reach) {
          list.splice(k, 1);
          continue;
        }
        const da = a - c.lastA;
        const db = b - c.lastB;
        if (da < 1 || db < 1 || da > reach || db > reach) continue;
        if (Math.abs(da - db) > SKEW) continue;
        if (
          corpus.doc[c.lastA] !== corpus.doc[a] ||
          corpus.doc[c.lastB] !== corpus.doc[b]
        ) {
          continue;
        }
        if (da + db < bestCost) {
          best = c;
          bestCost = da + db;
        }
      }
      if (list.length === 0) active.delete(dd);
    }

    if (best) {
      const oldD = best.lastB - best.lastA;
      best.covA += a + K - Math.max(a, best.lastA + K);
      best.covB += b + K - Math.max(b, best.lastB + K);
      best.lastA = a;
      best.lastB = b;
      if (oldD !== d) {
        const old = active.get(oldD);
        if (old) {
          const idx = old.indexOf(best);
          if (idx >= 0) old.splice(idx, 1);
          if (old.length === 0) active.delete(oldD);
        }
        pushActive(active, d, best);
      }
    } else {
      const chain: Chain = {
        startA: a,
        startB: b,
        lastA: a,
        lastB: b,
        covA: K,
        covB: K,
      };
      chains.push(chain);
      pushActive(active, d, chain);
    }
  }
  return chains;
}

function pushActive(active: Map<number, Chain[]>, d: number, c: Chain): void {
  const list = active.get(d);
  if (list) list.push(c);
  else active.set(d, [c]);
}

interface SpanPair {
  aStart: number;
  aEnd: number;
  bStart: number;
  bEnd: number;
  matched: number;
}

function acceptPairs(corpus: Corpus, chains: readonly Chain[]): SpanPair[] {
  const pairs: SpanPair[] = [];
  for (const c of chains) {
    const matched = Math.min(c.covA, c.covB);
    if (matched < REPEAT_MIN_MATCHED_TOKENS) continue;
    const aEnd = c.lastA + K;
    const bEnd = c.lastB + K;
    if (contentCount(corpus, c.startA, aEnd) < REPEAT_MIN_CONTENT_TOKENS) {
      continue;
    }
    if (
      corpus.doc[c.startA] === corpus.doc[c.startB] &&
      aEnd + REPEAT_MIN_SELF_DISTANCE_TOKENS > c.startB
    ) {
      continue;
    }
    pairs.push({ aStart: c.startA, aEnd, bStart: c.startB, bEnd, matched });
  }
  return pairs;
}

class UnionFind {
  private parent: Int32Array;
  constructor(size: number) {
    this.parent = new Int32Array(size);
    for (let i = 0; i < size; i++) this.parent[i] = i;
  }
  find(x: number): number {
    let root = x;
    while (this.parent[root] !== root) root = this.parent[root];
    while (this.parent[x] !== root) {
      const next = this.parent[x];
      this.parent[x] = root;
      x = next;
    }
    return root;
  }
  union(x: number, y: number): void {
    const rx = this.find(x);
    const ry = this.find(y);
    if (rx !== ry) this.parent[ry] = rx;
  }
}

interface Location {
  start: number;
  end: number;
}

/**
 * Merge substantially overlapping spans into locations ("this passage in
 * chapter 3"). Interval 2k is pair k's A side, 2k+1 its B side.
 */
function buildLocations(pairs: readonly SpanPair[]): {
  locationOf: Int32Array;
  locations: Location[];
} {
  const n = pairs.length * 2;
  const starts = new Int32Array(n);
  const ends = new Int32Array(n);
  pairs.forEach((p, k) => {
    starts[2 * k] = p.aStart;
    ends[2 * k] = p.aEnd;
    starts[2 * k + 1] = p.bStart;
    ends[2 * k + 1] = p.bEnd;
  });
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (x, y) => starts[x] - starts[y] || ends[x] - ends[y],
  );

  // Intervals never cross chapter boundaries (shingles don't), so global
  // overlap implies same-chapter overlap.
  const uf = new UnionFind(n);
  let open: number[] = [];
  for (const i of order) {
    open = open.filter((j) => ends[j] > starts[i]);
    for (const j of open) {
      const overlap = Math.min(ends[i], ends[j]) - starts[i];
      // Against the longer span: a short phrase inside a longer match is
      // its own location, or adjacent repeats would chain into one cluster.
      const longer = Math.max(ends[i] - starts[i], ends[j] - starts[j]);
      if (overlap >= REPEAT_LOCATION_MERGE_OVERLAP * longer) uf.union(i, j);
    }
    open.push(i);
  }

  const locationOf = new Int32Array(n);
  const locations: Location[] = [];
  const indexByRoot = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    let idx = indexByRoot.get(root);
    if (idx === undefined) {
      idx = locations.length;
      indexByRoot.set(root, idx);
      locations.push({ start: starts[i], end: ends[i] });
    } else {
      const loc = locations[idx];
      loc.start = Math.min(loc.start, starts[i]);
      loc.end = Math.max(loc.end, ends[i]);
    }
    locationOf[i] = idx;
  }
  return { locationOf, locations };
}

interface ScoredMember {
  location: number;
  redundantWords: number;
  bestEarlier: number | null;
}

interface ScoredCluster {
  members: ScoredMember[];
  redundantWords: number;
  score: number;
}

function buildClusters(
  pairs: readonly SpanPair[],
  locationOf: Int32Array,
  locations: readonly Location[],
): ScoredCluster[] {
  const uf = new UnionFind(locations.length);
  // Best match between each pair of locations, keyed "lo:hi".
  const edges = new Map<string, number>();
  const neighbours = new Map<number, Set<number>>();
  pairs.forEach((p, k) => {
    const x = locationOf[2 * k];
    const y = locationOf[2 * k + 1];
    if (x === y) return;
    uf.union(x, y);
    const key = x < y ? `${x}:${y}` : `${y}:${x}`;
    edges.set(key, Math.max(edges.get(key) ?? 0, p.matched));
    if (!neighbours.has(x)) neighbours.set(x, new Set());
    if (!neighbours.has(y)) neighbours.set(y, new Set());
    neighbours.get(x)?.add(y);
    neighbours.get(y)?.add(x);
  });

  const groups = new Map<number, number[]>();
  for (const loc of neighbours.keys()) {
    const root = uf.find(loc);
    const group = groups.get(root);
    if (group) group.push(loc);
    else groups.set(root, [loc]);
  }

  const clusters: ScoredCluster[] = [];
  for (const group of groups.values()) {
    group.sort((x, y) => locations[x].start - locations[y].start);
    const rank = new Map(group.map((loc, i) => [loc, i]));
    const members: ScoredMember[] = group.map((loc, i) => {
      let redundantWords = 0;
      let bestEarlier: number | null = null;
      for (const other of neighbours.get(loc) ?? []) {
        const otherRank = rank.get(other);
        if (otherRank === undefined || otherRank >= i) continue;
        const key = loc < other ? `${loc}:${other}` : `${other}:${loc}`;
        const matched = edges.get(key) ?? 0;
        if (
          matched > redundantWords ||
          (matched === redundantWords &&
            bestEarlier !== null &&
            otherRank < bestEarlier)
        ) {
          redundantWords = matched;
          bestEarlier = otherRank;
        }
      }
      return { location: loc, redundantWords, bestEarlier };
    });
    let redundantWords = 0;
    let score = 0;
    for (const m of members) {
      redundantWords += m.redundantWords;
      if (m.redundantWords > 0) score += repeatWeight(m.redundantWords);
    }
    clusters.push({ members, redundantWords, score });
  }
  return clusters;
}

/** Number of identical word runs starting earlier in the same chapter. */
function countEarlierOccurrences(
  corpus: Corpus,
  postings: Map<number, number[]>,
  start: number,
  end: number,
): number {
  const candidates = postings.get(shingleHash(corpus.ids, start)) ?? [];
  const docFirst = corpus.docStart[corpus.doc[start]];
  let count = 0;
  for (const p of candidates) {
    if (p >= start) break;
    if (p < docFirst) continue;
    if (sameRun(corpus.ids, p, start, end - start)) count++;
  }
  return count;
}

function spanText(chapter: TokenizedChapter, from: number, to: number): string {
  const pieces: string[] = [];
  let runStart = from;
  for (let i = from; i < to; i++) {
    const last = i === to - 1;
    const tok = chapter.tokens[i];
    if (last || chapter.tokens[i + 1].paragraphIndex !== tok.paragraphIndex) {
      const first = chapter.tokens[runStart];
      pieces.push(
        chapter.paragraphs[tok.paragraphIndex].slice(first.start, tok.end),
      );
      runStart = i + 1;
    }
  }
  return pieces.join("\n");
}

function toMember(
  chapters: readonly TokenizedChapter[],
  corpus: Corpus,
  postings: Map<number, number[]>,
  location: Location,
  scored: ScoredMember,
): RepeatMember {
  const d = corpus.doc[location.start];
  const chapter = chapters[d];
  const from = location.start - corpus.docStart[d];
  const to = location.end - corpus.docStart[d];
  const text = spanText(chapter, from, to);
  return {
    chapterId: chapter.chapterId,
    text,
    excerpt: makeExcerpt(text.replace(/\n/g, " ")),
    anchor: {
      tokens: chapter.tokens.slice(from, to).map((t) => t.word),
      occurrence: countEarlierOccurrences(
        corpus,
        postings,
        location.start,
        location.end,
      ),
    },
    redundantWords: scored.redundantWords,
    bestEarlier: scored.bestEarlier,
  };
}

/**
 * Find passages whose wording recurs across (or far apart within) the given
 * chapters, which must be in reading order. Copies are grouped into
 * clusters; the first copy a reader meets is free, and each later copy
 * counts the words it shares with its closest earlier copy. Returns null
 * when cancelled.
 */
export function findRepeatedPassages(
  chapters: readonly TokenizedChapter[],
  options: { isCancelled?: () => boolean } = {},
): RepeatReport | null {
  const isCancelled = options.isCancelled ?? (() => false);
  const corpus = buildCorpus(chapters);
  const postings = indexShingles(corpus);
  if (isCancelled()) return null;
  const seeds = generateSeeds(corpus, postings);
  if (isCancelled()) return null;
  const chains = chainSeeds(corpus, seeds, isCancelled);
  if (!chains) return null;
  const pairs = acceptPairs(corpus, chains);
  const { locationOf, locations } = buildLocations(pairs);
  if (isCancelled()) return null;
  const scored = buildClusters(pairs, locationOf, locations);

  scored.sort(
    (x, y) =>
      y.score - x.score ||
      locations[x.members[0].location].start -
        locations[y.members[0].location].start,
  );
  const totalRedundantWords = scored.reduce((n, c) => n + c.redundantWords, 0);

  const clusters: RepeatCluster[] = scored
    .slice(0, REPEAT_CLUSTER_LIMIT)
    .map((c) => {
      const members = c.members.map((m) =>
        toMember(chapters, corpus, postings, locations[m.location], m),
      );
      const firstLoc = locations[c.members[0].location];
      const firstLocal =
        firstLoc.start - corpus.docStart[corpus.doc[firstLoc.start]];
      return {
        id: `${members[0].chapterId}:${firstLocal}`,
        members,
        redundantWords: c.redundantWords,
        score: c.score,
      };
    });

  return { clusters, totalRedundantWords };
}
