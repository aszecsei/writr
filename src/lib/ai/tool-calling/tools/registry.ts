/**
 * Consolidated read tools: `list` and `get` cover the simple list-by-project
 * and get-by-id patterns that previously needed a tool per entity (12 tools
 * → 2). Categories with non-uniform read shapes — chapter content
 * (read_chapter / read_chapter_range / search_chapter / get_chapter_structure),
 * the path-based reader bible (bible_read / bible_list), and project-wide
 * search — keep their own tools.
 *
 * Per-category permission gating: agents whitelist scoped ids
 * (`list:character`, `get:summary`, ...) instead of the unscoped `list` /
 * `get`. The agent-side filter (`tool-filter.ts`) narrows the surfaced
 * `category` enum to the agent's permitted categories; this module re-checks
 * at execution time as defense-in-depth.
 */

import { z } from "zod";
import {
  getChapterSummary,
  hashChapterContent,
  upsertChapterSummary,
} from "@/db/operations/chapterSummaries";
import { getChapter, getChaptersByProject } from "@/db/operations/chapters";
import {
  getCharacter,
  getCharactersByProject,
} from "@/db/operations/characters";
import { getLocation, getLocationsByProject } from "@/db/operations/locations";
import {
  getOutlineGridCellsByProject,
  getOutlineGridColumnsByProject,
  getOutlineGridRowsByProject,
} from "@/db/operations/outline";
import { getAppSettings } from "@/db/operations/settings";
import {
  getStyleGuideByProject,
  getStyleGuideEntry,
} from "@/db/operations/style-guide";
import {
  getTimelineByProject,
  getTimelineEvent,
} from "@/db/operations/timeline";
import {
  getWorldbuildingDoc,
  getWorldbuildingDocsByProject,
} from "@/db/operations/worldbuilding";
import type {
  ChapterId,
  CharacterId,
  LocationId,
  StyleGuideEntryId,
  TimelineEventId,
  WorldbuildingDocId,
} from "@/db/schemas";
import { summarizeChapter } from "@/lib/ai/client";
import { buildNameMap, serializeOutlineGrid } from "@/lib/ai/serialize";
import { defineTool, type ToolExecutionContext } from "../types";
import { ok, SCENE_BREAK_RE, splitParagraphs } from "./helpers";

// ─── Categories ────────────────────────────────────────────────────────

/** All categories supported by either `list` or `get`. */
export const READ_CATEGORIES = [
  "character",
  "location",
  "timeline",
  "chapter",
  "style_guide",
  "worldbuilding",
  "outline",
  "summary",
] as const;

export type ReadCategory = (typeof READ_CATEGORIES)[number];

const ReadCategoryEnum = z.enum(READ_CATEGORIES);

/** Categories valid for `list` (have a project-wide index). */
export const LIST_CATEGORIES: readonly ReadCategory[] = [
  "character",
  "location",
  "timeline",
  "chapter",
  "style_guide",
  "worldbuilding",
] as const;

/** Categories valid for `get`. Includes singletons and chapter-keyed lookups. */
export const GET_CATEGORIES: readonly ReadCategory[] = READ_CATEGORIES;

const ListCategoryEnum = z.enum(
  LIST_CATEGORIES as readonly [ReadCategory, ...ReadCategory[]],
);

// ─── Per-category adapters ─────────────────────────────────────────────

interface ListResult {
  /** Human-readable summary for the assistant. */
  message: string;
  /** Entries returned to the LLM under `data.entries`. */
  entries: Record<string, unknown>[];
}

interface GetResult {
  /** When `null`, the requested record was not found. */
  data: Record<string, unknown> | null;
  /** Optional explanation when `data` is null (e.g. forward-only refusal). */
  error?: string;
}

interface CategoryAdapter {
  /** Whether the category supports `list`. */
  list?: (context: ToolExecutionContext) => Promise<ListResult>;
  /** Whether the category supports `get`. Singletons (outline) ignore `id`. */
  get?: (
    id: string | undefined,
    context: ToolExecutionContext,
  ) => Promise<GetResult>;
  /** True when `get` returns a single record without needing an id. */
  singleton?: boolean;
}

const CATEGORY_ADAPTERS: Record<ReadCategory, CategoryAdapter> = {
  character: {
    async list(ctx) {
      const rows = await getCharactersByProject(ctx.projectId);
      return {
        message: `Found ${rows.length} characters`,
        entries: rows.map((c) => ({ id: c.id, name: c.name, role: c.role })),
      };
    },
    async get(id) {
      if (!id) return { data: null, error: "character get requires an id" };
      const c = await getCharacter(id as CharacterId);
      if (!c) return { data: null, error: `Character not found: ${id}` };
      return {
        data: {
          id: c.id,
          name: c.name,
          role: c.role,
          pronouns: c.pronouns,
          description: c.description,
          personality: c.personality,
          motivations: c.motivations,
          backstory: c.backstory,
          strengths: c.strengths,
          weaknesses: c.weaknesses,
          dialogueStyle: c.dialogueStyle,
          aliases: c.aliases,
        },
      };
    },
  },

  location: {
    async list(ctx) {
      const rows = await getLocationsByProject(ctx.projectId);
      return {
        message: `Found ${rows.length} locations`,
        entries: rows.map((l) => ({ id: l.id, name: l.name })),
      };
    },
    async get(id) {
      if (!id) return { data: null, error: "location get requires an id" };
      const l = await getLocation(id as LocationId);
      if (!l) return { data: null, error: `Location not found: ${id}` };
      return {
        data: {
          id: l.id,
          name: l.name,
          description: l.description,
          notes: l.notes,
        },
      };
    },
  },

  timeline: {
    async list(ctx) {
      const rows = await getTimelineByProject(ctx.projectId);
      return {
        message: `Found ${rows.length} timeline events`,
        entries: rows.map((e) => ({ id: e.id, title: e.title, date: e.date })),
      };
    },
    async get(id) {
      if (!id) return { data: null, error: "timeline get requires an id" };
      const e = await getTimelineEvent(id as TimelineEventId);
      if (!e) return { data: null, error: `Timeline event not found: ${id}` };
      return {
        data: {
          id: e.id,
          title: e.title,
          description: e.description,
          date: e.date,
        },
      };
    },
  },

  chapter: {
    async list(ctx) {
      const all = await getChaptersByProject(ctx.projectId);
      const readable = ctx.readableChapterIds;
      const rows = readable ? all.filter((c) => readable.has(c.id)) : all;
      return {
        message: `Found ${rows.length} chapters`,
        entries: rows.map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          wordCount: c.wordCount,
        })),
      };
    },
    async get(id, ctx) {
      if (!id) return { data: null, error: "chapter get requires an id" };
      const ch = await getChapter(id as ChapterId);
      if (!ch) return { data: null, error: `Chapter not found: ${id}` };
      if (ctx.readableChapterIds && !ctx.readableChapterIds.has(ch.id)) {
        return {
          data: null,
          error: `Chapter "${ch.title}" is beyond the current reading position; cannot read ahead in a comprehension pass.`,
        };
      }
      const paragraphs = splitParagraphs(ch.content);
      const hasSceneBreaks = paragraphs.some((p) => SCENE_BREAK_RE.test(p));
      return {
        data: {
          id: ch.id,
          title: ch.title,
          synopsis: ch.synopsis,
          status: ch.status,
          wordCount: ch.wordCount,
          totalParagraphs: paragraphs.length,
          hasSceneBreaks,
        },
      };
    },
  },

  style_guide: {
    async list(ctx) {
      const rows = await getStyleGuideByProject(ctx.projectId);
      return {
        message: `Found ${rows.length} style guide entries`,
        entries: rows.map((s) => ({
          id: s.id,
          title: s.title,
          category: s.category,
        })),
      };
    },
    async get(id) {
      if (!id) return { data: null, error: "style_guide get requires an id" };
      const e = await getStyleGuideEntry(id as StyleGuideEntryId);
      if (!e)
        return { data: null, error: `Style guide entry not found: ${id}` };
      return {
        data: {
          id: e.id,
          title: e.title,
          category: e.category,
          content: e.content,
        },
      };
    },
  },

  worldbuilding: {
    async list(ctx) {
      const rows = await getWorldbuildingDocsByProject(ctx.projectId);
      return {
        message: `Found ${rows.length} worldbuilding docs`,
        entries: rows.map((d) => ({
          id: d.id,
          title: d.title,
          tags: d.tags,
          parentDocId: d.parentDocId,
        })),
      };
    },
    async get(id) {
      if (!id) return { data: null, error: "worldbuilding get requires an id" };
      const d = await getWorldbuildingDoc(id as WorldbuildingDocId);
      if (!d)
        return { data: null, error: `Worldbuilding doc not found: ${id}` };
      return {
        data: {
          id: d.id,
          title: d.title,
          content: d.content,
          tags: d.tags,
          parentDocId: d.parentDocId,
        },
      };
    },
  },

  outline: {
    singleton: true,
    async get(_id, ctx) {
      const [columns, rows, cells, chapters] = await Promise.all([
        getOutlineGridColumnsByProject(ctx.projectId),
        getOutlineGridRowsByProject(ctx.projectId),
        getOutlineGridCellsByProject(ctx.projectId),
        getChaptersByProject(ctx.projectId),
      ]);
      if (columns.length === 0) {
        return {
          data: {
            outline: null,
            message: "No outline grid configured for this project.",
          },
        };
      }
      const chapterMap = buildNameMap(chapters, (c) => c.title);
      const serialized = serializeOutlineGrid(columns, rows, cells, chapterMap);
      return { data: { outline: serialized } };
    },
  },

  summary: {
    async get(id, ctx) {
      if (!id)
        return { data: null, error: "summary get requires a chapter id" };
      const chapter = await getChapter(id as ChapterId);
      if (!chapter) return { data: null, error: `Chapter not found: ${id}` };
      if (chapter.projectId !== ctx.projectId) {
        return { data: null, error: "Chapter belongs to a different project" };
      }

      const hash = await hashChapterContent(chapter.content);
      const cached = await getChapterSummary(id as ChapterId, hash);
      if (cached) {
        return {
          data: {
            chapterId: chapter.id,
            title: chapter.title,
            summary: cached.summary,
            cached: true,
          },
        };
      }

      // Cache miss: synthesize via a one-shot model call. Uses the global
      // default model since summaries are a utility, not part of the agent's
      // reasoning chain.
      const settings = await getAppSettings();
      const apiKey = settings.providerApiKeys[settings.aiProvider];
      if (!apiKey) {
        return {
          data: null,
          error:
            "Cannot compute summary: no API key configured for the active provider.",
        };
      }
      let summary: string;
      try {
        summary = (
          await summarizeChapter(chapter.title, chapter.content, {
            apiKey,
            model: settings.providerModels[settings.aiProvider],
            provider: settings.aiProvider,
          })
        ).trim();
      } catch (err) {
        return {
          data: null,
          error: err instanceof Error ? err.message : "Summary request failed",
        };
      }
      if (!summary)
        return { data: null, error: "Model returned an empty summary" };

      const row = await upsertChapterSummary({
        projectId: chapter.projectId,
        chapterId: chapter.id,
        sourceContentHash: hash,
        summary,
      });
      return {
        data: {
          chapterId: chapter.id,
          title: chapter.title,
          summary: row.summary,
          cached: false,
        },
      };
    },
  },
};

// ─── Permission helpers ────────────────────────────────────────────────

/**
 * Categories the agent's `allowedToolIds` permits for the given verb. Returns
 * `null` when the agent has no entry for that verb at all (= verb forbidden);
 * returns an empty `Set` when an unscoped `list` / `get` is present (= all
 * categories permitted). Scoped ids look like `list:character`, `get:summary`.
 */
export function permittedCategories(
  verb: "list" | "get",
  allowedToolIds: readonly string[] | undefined,
): Set<ReadCategory> | "all" | null {
  if (!allowedToolIds) return "all";
  let unscopedSeen = false;
  const out = new Set<ReadCategory>();
  for (const id of allowedToolIds) {
    if (id === verb) {
      unscopedSeen = true;
      continue;
    }
    if (!id.startsWith(`${verb}:`)) continue;
    const cat = id.slice(verb.length + 1) as ReadCategory;
    if ((READ_CATEGORIES as readonly string[]).includes(cat)) {
      out.add(cat);
    }
  }
  if (unscopedSeen) return "all";
  if (out.size === 0) return null;
  return out;
}

// ─── Tools ─────────────────────────────────────────────────────────────

const listInputSchema = z
  .object({
    category: ListCategoryEnum,
  })
  .strip();

export const listTool = defineTool({
  id: "list",
  category: "read",
  name: "List Entries",
  description:
    "List all entries of one category in the project. Returns each entry's id and a small set of summary fields. " +
    "Categories: character, location, timeline, chapter, style_guide, worldbuilding. " +
    "Follow up with `get` to fetch full details for specific ids.",
  parameters: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description: "Entity category to list.",
        enum: [...LIST_CATEGORIES],
      },
    },
    required: ["category"],
  },
  inputSchema: listInputSchema,
  requiresApproval: false,
  async execute(params, context) {
    const adapter = CATEGORY_ADAPTERS[params.category];
    if (!adapter.list) {
      return {
        success: false,
        message: `list is not supported for category "${params.category}"`,
      };
    }
    const result = await adapter.list(context);
    return ok(result.message, {
      category: params.category,
      entries: result.entries,
    });
  },
});

const getRequestSchema = z
  .object({
    category: ReadCategoryEnum,
    ids: z.array(z.string().min(1)).optional(),
  })
  .strip();

const getInputSchema = z
  .object({
    requests: z.array(getRequestSchema).min(1),
  })
  .strip();

interface GetResultEntry {
  category: ReadCategory;
  id?: string;
  found: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export const getTool = defineTool({
  id: "get",
  category: "read",
  name: "Get Entries",
  description:
    "Fetch full details for one or more entries in one or more categories. " +
    "Pass an array of {category, ids} requests; results come back in the same order. " +
    "Singleton categories (outline) take no ids; chapter-keyed categories (summary) take chapter ids. " +
    "A missing or out-of-bounds id returns `found: false` for that entry without failing the whole call.",
  parameters: {
    type: "object",
    properties: {
      requests: {
        type: "array",
        description: "Per-category lookup requests.",
        items: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Entity category.",
              enum: [...GET_CATEGORIES],
            },
            ids: {
              type: "array",
              description:
                "Ids to fetch. Required for non-singleton categories; ignored for outline.",
              items: { type: "string" },
            },
          },
          required: ["category"],
        },
      },
    },
    required: ["requests"],
  },
  inputSchema: getInputSchema,
  requiresApproval: false,
  async execute(params, context) {
    const results: GetResultEntry[] = [];
    for (const req of params.requests) {
      const adapter = CATEGORY_ADAPTERS[req.category];
      if (!adapter.get) {
        results.push({
          category: req.category,
          found: false,
          error: `get is not supported for category "${req.category}"`,
        });
        continue;
      }
      if (adapter.singleton) {
        const r = await adapter.get(undefined, context);
        results.push({
          category: req.category,
          found: r.data !== null,
          ...(r.data !== null ? { data: r.data } : {}),
          ...(r.error ? { error: r.error } : {}),
        });
        continue;
      }
      const ids = req.ids ?? [];
      if (ids.length === 0) {
        results.push({
          category: req.category,
          found: false,
          error: `get for category "${req.category}" requires at least one id`,
        });
        continue;
      }
      for (const id of ids) {
        const r = await adapter.get(id, context);
        results.push({
          category: req.category,
          id,
          found: r.data !== null,
          ...(r.data !== null ? { data: r.data } : {}),
          ...(r.error ? { error: r.error } : {}),
        });
      }
    }
    const found = results.filter((r) => r.found).length;
    return ok(`Fetched ${found}/${results.length} entries`, { results });
  },
});
