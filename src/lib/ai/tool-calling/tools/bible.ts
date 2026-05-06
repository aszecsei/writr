import { z } from "zod";
import {
  appendBibleOp,
  listBiblePaths,
  ReaderBiblePathError,
  readBibleAtPath,
} from "@/db/operations/readerBible";
import { READER_BIBLE_TOP_LEVEL_PATHS } from "@/db/schemas";
import { defineTool } from "../types";
import { fail, ok } from "./helpers";

const BIBLE_PATH_HINT = `The first segment must be one of: ${READER_BIBLE_TOP_LEVEL_PATHS.join(
  ", ",
)}.`;

// ─── bible_read ─────────────────────────────────────────────────────

export const bibleReadTool = defineTool({
  id: "bible_read",
  category: "bible",
  name: "Read Reader Bible",
  description:
    "Read a value from the reader's bible (separate from the user's authored bible). Returns the JSON value at `path`, or null if no entry exists. " +
    BIBLE_PATH_HINT,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Slash-separated path, e.g. 'characters/Kira/relationships'.",
      },
    },
    required: ["path"],
  },
  inputSchema: z.object({
    path: z.string().min(1),
  }),
  requiresApproval: false,
  async execute(params, context) {
    if (!context.runId) return fail("bible_read requires a run context");
    try {
      const entry = await readBibleAtPath(context.runId, params.path);
      return ok(
        entry
          ? `Read bible path '${entry.path}'`
          : `No entry at '${params.path}'`,
        { value: entry?.value ?? null, path: entry?.path ?? params.path },
      );
    } catch (err) {
      if (err instanceof ReaderBiblePathError) return fail(err.message);
      throw err;
    }
  },
});

// ─── bible_write ────────────────────────────────────────────────────

export const bibleWriteTool = defineTool({
  id: "bible_write",
  category: "bible",
  name: "Write Reader Bible",
  description:
    "Append an entry to the reader's bible. `op=set` replaces the value, `merge` deep-merges into the existing object, `delete` removes the entry. " +
    "Always include `asOfChapter` (1-based) when the fact comes from a specific chapter; null = applies across all reader-knowledge. " +
    BIBLE_PATH_HINT,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Slash-separated path, e.g. 'open_threads/locked-door'.",
      },
      op: {
        type: "string",
        description: "Mutation type",
        enum: ["set", "merge", "delete"],
      },
      value: {
        type: "string",
        description:
          "JSON-encoded value (object/array/string/number/bool). Required for set/merge.",
      },
      asOfChapter: {
        type: "number",
        description:
          "Chapter index (1-based) where this fact was established. Use null for cross-cutting observations.",
      },
    },
    required: ["path", "op"],
  },
  inputSchema: z.object({
    path: z.string().min(1),
    op: z.enum(["set", "merge", "delete"]),
    value: z.string().optional(),
    asOfChapter: z.number().int().nonnegative().nullable().optional(),
  }),
  requiresApproval: false,
  async execute(params, context) {
    if (!context.runId) return fail("bible_write requires a run context");

    let parsedValue: unknown;
    if (params.op !== "delete") {
      if (params.value === undefined) {
        return fail(`'${params.op}' requires a value`);
      }
      try {
        parsedValue = JSON.parse(params.value);
      } catch {
        // Allow plain strings without JSON quoting as a convenience.
        parsedValue = params.value;
      }
    }

    try {
      const entry = await appendBibleOp({
        projectId: context.projectId,
        runId: context.runId,
        path: params.path,
        op: params.op,
        value: parsedValue,
        asOfChapter: params.asOfChapter ?? null,
      });
      return ok(`Wrote ${params.op} to '${entry.path}'`, {
        path: entry.path,
        op: entry.op,
        logEntryId: entry.id,
      });
    } catch (err) {
      if (err instanceof ReaderBiblePathError) return fail(err.message);
      throw err;
    }
  },
});

// ─── bible_list ─────────────────────────────────────────────────────

export const bibleListTool = defineTool({
  id: "bible_list",
  category: "bible",
  name: "List Reader Bible Paths",
  description:
    "List all reader-bible paths under an optional prefix (e.g. 'characters/' returns every character entry). Omit pathPrefix to list everything.",
  parameters: {
    type: "object",
    properties: {
      pathPrefix: {
        type: "string",
        description: "Optional prefix, e.g. 'characters' or 'open_threads/'.",
      },
    },
  },
  inputSchema: z.object({
    pathPrefix: z.string().optional(),
  }),
  requiresApproval: false,
  async execute(params, context) {
    if (!context.runId) return fail("bible_list requires a run context");
    try {
      const entries = await listBiblePaths(context.runId, params.pathPrefix);
      return ok(`Found ${entries.length} bible paths`, {
        paths: entries.map((e) => ({
          path: e.path,
          lastUpdatedAt: e.lastUpdatedAt,
        })),
      });
    } catch (err) {
      if (err instanceof ReaderBiblePathError) return fail(err.message);
      throw err;
    }
  },
});
