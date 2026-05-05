import { db } from "../database";
import {
  READER_BIBLE_TOP_LEVEL_PATHS,
  type ReaderBibleLogEntry,
  ReaderBibleLogEntrySchema,
  type ReaderBibleOp,
  type ReaderBibleViewEntry,
  ReaderBibleViewEntrySchema,
} from "../schemas";
import { generateId, now } from "./helpers";

const TOP_LEVEL_SET = new Set<string>(READER_BIBLE_TOP_LEVEL_PATHS);

export class ReaderBiblePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReaderBiblePathError";
  }
}

/**
 * Normalize a slash-segmented path. Strips leading/trailing slashes, collapses
 * empty segments, and validates the top-level segment against the allowlist.
 * Returns the canonical form (e.g. `"characters/Kira/relationships"`).
 */
export function normalizeBiblePath(rawPath: string): string {
  const segments = rawPath
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (segments.length === 0) {
    throw new ReaderBiblePathError("Path must have at least one segment");
  }
  const top = segments[0];
  if (!TOP_LEVEL_SET.has(top)) {
    throw new ReaderBiblePathError(
      `Top-level path '${top}' is not allowed. Use one of: ${READER_BIBLE_TOP_LEVEL_PATHS.join(", ")}`,
    );
  }
  return segments.join("/");
}

/** Deep-merge two JSON-shaped values. Arrays/primitives in `next` replace `prev`. */
function deepMerge(prev: unknown, next: unknown): unknown {
  if (
    prev !== null &&
    typeof prev === "object" &&
    !Array.isArray(prev) &&
    next !== null &&
    typeof next === "object" &&
    !Array.isArray(next)
  ) {
    const result: Record<string, unknown> = {
      ...(prev as Record<string, unknown>),
    };
    for (const [k, v] of Object.entries(next as Record<string, unknown>)) {
      if (k in result) {
        result[k] = deepMerge(result[k], v);
      } else {
        result[k] = v;
      }
    }
    return result;
  }
  return next;
}

interface AppendBibleOpInput {
  projectId: string;
  runId: string;
  path: string;
  op: ReaderBibleOp;
  value?: unknown;
  asOfChapter?: number | null;
  agentMessageId?: string | null;
}

/**
 * Append a reader-bible log entry and patch the materialized view atomically.
 * Returns the log entry that was written.
 */
export async function appendBibleOp(
  input: AppendBibleOpInput,
): Promise<ReaderBibleLogEntry> {
  const path = normalizeBiblePath(input.path);
  const timestamp = now();

  const entry = ReaderBibleLogEntrySchema.parse({
    id: generateId(),
    projectId: input.projectId,
    runId: input.runId,
    path,
    op: input.op,
    value: input.value,
    asOfChapter: input.asOfChapter ?? null,
    agentMessageId: input.agentMessageId ?? null,
    createdAt: timestamp,
  });

  await db.transaction(
    "rw",
    db.readerBibleLog,
    db.readerBibleView,
    async () => {
      await db.readerBibleLog.add(entry);

      const existing = await db.readerBibleView
        .where({ projectId: input.projectId, path })
        .first();

      if (input.op === "delete") {
        if (existing) await db.readerBibleView.delete(existing.id);
        return;
      }

      let nextValue = input.value;
      if (input.op === "merge" && existing) {
        nextValue = deepMerge(existing.value, input.value);
      }

      if (existing) {
        await db.readerBibleView.update(existing.id, {
          value: nextValue,
          lastUpdatedAt: timestamp,
          lastLogEntryId: entry.id,
        });
      } else {
        const view = ReaderBibleViewEntrySchema.parse({
          id: generateId(),
          projectId: input.projectId,
          path,
          value: nextValue,
          lastUpdatedAt: timestamp,
          lastLogEntryId: entry.id,
        });
        await db.readerBibleView.add(view);
      }
    },
  );

  return entry;
}

/** Read the current view value at `path`. Returns undefined if no entry. */
export async function readBibleAtPath(
  projectId: string,
  path: string,
): Promise<ReaderBibleViewEntry | undefined> {
  const normalized = normalizeBiblePath(path);
  return db.readerBibleView.where({ projectId, path: normalized }).first();
}

/** List view entries under a path prefix (or everything when prefix is empty). */
export async function listBiblePaths(
  projectId: string,
  pathPrefix?: string,
): Promise<ReaderBibleViewEntry[]> {
  const all = await db.readerBibleView.where({ projectId }).toArray();
  if (!pathPrefix) return all.sort((a, b) => a.path.localeCompare(b.path));
  const prefix = pathPrefix.endsWith("/") ? pathPrefix : `${pathPrefix}/`;
  return all
    .filter((e) => e.path === pathPrefix || e.path.startsWith(prefix))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Replay the log to compute the bible as it was when the reader had processed
 * up to and including chapter `asOfChapter`. Used by the verifier to check
 * whether new manuscript text contradicts the bible at the time of writing.
 *
 * Entries with `asOfChapter == null` are treated as having always been in
 * scope (they're typically post-pass corrections that should always apply).
 */
export async function computeReaderBibleAsOf(
  projectId: string,
  asOfChapter: number,
): Promise<Map<string, unknown>> {
  const entries = await db.readerBibleLog
    .where({ projectId })
    .filter(
      (e) =>
        e.asOfChapter == null ||
        (typeof e.asOfChapter === "number" && e.asOfChapter <= asOfChapter),
    )
    .sortBy("createdAt");

  const view = new Map<string, unknown>();
  for (const entry of entries) {
    if (entry.op === "delete") {
      view.delete(entry.path);
      continue;
    }
    if (entry.op === "merge" && view.has(entry.path)) {
      view.set(entry.path, deepMerge(view.get(entry.path), entry.value));
    } else {
      view.set(entry.path, entry.value);
    }
  }
  return view;
}

/** Bulk-load all log entries for a run, ordered chronologically. */
export async function getBibleLogByRun(
  runId: string,
): Promise<ReaderBibleLogEntry[]> {
  return db.readerBibleLog.where({ runId }).sortBy("createdAt");
}

/**
 * Count log entries for a run that occurred after the given timestamp.
 * Used by the reader loop to compute per-pass deltas.
 */
export async function countBibleLogEntriesSince(
  runId: string,
  sinceIso: string,
): Promise<number> {
  return db.readerBibleLog
    .where({ runId })
    .filter((e) => e.createdAt > sinceIso)
    .count();
}
