"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { ReaderBibleLogEntry, ReaderBibleViewEntry } from "@/db/schemas";

/** Live view of all reader-bible entries for a run, sorted by path. */
export function useReaderBible(
  runId: string | null,
): ReaderBibleViewEntry[] | undefined {
  return useLiveQuery(async () => {
    if (!runId) return [];
    const all = await db.readerBibleView.where({ runId }).toArray();
    return all.sort((a, b) => a.path.localeCompare(b.path));
  }, [runId]);
}

/** Live view of a single reader-bible path (or null when missing). */
export function useReaderBiblePath(
  runId: string | null,
  path: string | null,
): ReaderBibleViewEntry | null | undefined {
  return useLiveQuery(async () => {
    if (!runId || !path) return null;
    const entry = await db.readerBibleView.where({ runId, path }).first();
    return entry ?? null;
  }, [runId, path]);
}

/** Live log entries for a run (chronological). */
export function useReaderBibleLog(
  runId: string | null,
): ReaderBibleLogEntry[] | undefined {
  return useLiveQuery(
    () => (runId ? db.readerBibleLog.where({ runId }).sortBy("createdAt") : []),
    [runId],
  );
}
