import type { HoleDelimiters } from "@/lib/holes";
import type { ChapterAnalysis } from "./types";

/**
 * In-memory, module-level cache of per-chapter analyses. Results are
 * derived data, so nothing is persisted; the cache only saves recomputing
 * unchanged chapters while the panel is open or reopened within a session.
 *
 * Keyed by chapter id; an entry is valid only while the chapter's
 * updatedAt and the configured hole delimiters both match.
 */

const MAX_ENTRIES = 500;

interface CacheEntry {
  key: string;
  analysis: ChapterAnalysis;
}

const cache = new Map<string, CacheEntry>();

export function makeAnalysisCacheKey(
  updatedAt: string,
  delimiters: HoleDelimiters,
): string {
  return `${updatedAt}|${delimiters.open}|${delimiters.close}`;
}

export function getCachedAnalysis(
  chapterId: string,
  key: string,
): ChapterAnalysis | null {
  const entry = cache.get(chapterId);
  if (!entry || entry.key !== key) return null;
  // Re-insert so Map iteration order doubles as LRU order.
  cache.delete(chapterId);
  cache.set(chapterId, entry);
  return entry.analysis;
}

export function setCachedAnalysis(
  chapterId: string,
  key: string,
  analysis: ChapterAnalysis,
): void {
  cache.delete(chapterId);
  cache.set(chapterId, { key, analysis });
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

export function clearAnalysisCache(): void {
  cache.clear();
}
