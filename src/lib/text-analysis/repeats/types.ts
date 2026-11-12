import type { ChapterId } from "@/db/schemas";

export interface WordToken {
  /** Lowercased, straight-apostrophe form used for matching. */
  word: string;
  paragraphIndex: number;
  /** Offsets into `paragraphs[paragraphIndex]`. */
  start: number;
  end: number;
}

export interface TokenizedChapter {
  chapterId: ChapterId;
  paragraphs: readonly string[];
  tokens: readonly WordToken[];
}

/**
 * Locates a passage in the live editor without character offsets, which
 * don't survive the markdown → plain-text reduction: the passage's word
 * sequence, plus how many identical sequences precede it in the chapter.
 */
export interface PassageAnchor {
  tokens: readonly string[];
  occurrence: number;
}

export interface RepeatMember {
  chapterId: ChapterId;
  /** Plain span text; paragraph breaks inside the span become "\n". */
  text: string;
  excerpt: string;
  anchor: PassageAnchor;
  /** Words shared with `bestEarlier`; 0 for the first occurrence. */
  redundantWords: number;
  /** Index into the cluster's members of the closest earlier copy. */
  bestEarlier: number | null;
}

export interface RepeatCluster {
  id: string;
  /** In reading order. */
  members: RepeatMember[];
  redundantWords: number;
  score: number;
}

export interface RepeatReport {
  clusters: RepeatCluster[];
  totalRedundantWords: number;
}
