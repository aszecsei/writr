import { db } from "../database";
import { type ChapterSummary, ChapterSummarySchema } from "../schemas";
import { generateId, now } from "./helpers";

/**
 * sha-256 hash of the chapter content. Used as the cache key so summaries
 * silently invalidate when the source chapter changes.
 */
export async function hashChapterContent(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Look up a cached summary by (chapterId, contentHash). Returns undefined when
 * either the chapter has no summary or the source has changed since the
 * summary was generated.
 */
export async function getChapterSummary(
  chapterId: string,
  sourceContentHash: string,
): Promise<ChapterSummary | undefined> {
  return db.chapterSummaries
    .where("[chapterId+sourceContentHash]")
    .equals([chapterId, sourceContentHash])
    .first();
}

export interface UpsertChapterSummaryInput {
  projectId: string;
  chapterId: string;
  sourceContentHash: string;
  summary: string;
}

/**
 * Insert a fresh summary and prune any older summaries for the same chapter
 * (cache invalidation on hash mismatch). Atomic in one transaction.
 */
export async function upsertChapterSummary(
  input: UpsertChapterSummaryInput,
): Promise<ChapterSummary> {
  const fresh = ChapterSummarySchema.parse({
    id: generateId(),
    projectId: input.projectId,
    chapterId: input.chapterId,
    sourceContentHash: input.sourceContentHash,
    summary: input.summary,
    createdAt: now(),
  });

  await db.transaction("rw", db.chapterSummaries, async () => {
    // Drop stale rows for this chapter (any with a different hash).
    const existing = await db.chapterSummaries
      .where({ chapterId: input.chapterId })
      .toArray();
    for (const row of existing) {
      if (row.sourceContentHash !== input.sourceContentHash) {
        await db.chapterSummaries.delete(row.id);
      }
    }
    // Avoid duplicate matching rows.
    const match = existing.find(
      (r) => r.sourceContentHash === input.sourceContentHash,
    );
    if (!match) {
      await db.chapterSummaries.add(fresh);
    }
  });

  return fresh;
}
