import { z } from "zod";
import {
  createChapter,
  getChapter,
  updateChapter,
} from "@/db/operations/chapters";
import { type ChapterId, ChapterStatusEnum } from "@/db/schemas";
import {
  searchChapterParagraphsKeyword,
  searchChaptersKeyword,
} from "@/lib/search/keyword/search";
import { splitParagraphs } from "@/lib/text/split-paragraphs";
import { defineTool } from "../types";
import { fail, ok, SCENE_BREAK_RE } from "./helpers";

// CRUD: chapter create/update plus the chapter-content read tools
// (read_chapter / read_chapter_range / search_chapter / search_chapters /
// get_chapter_structure). Simple list/get-by-id use the consolidated
// `list` / `get` tools — see ./registry.ts.

export const createChapterTool = defineTool({
  id: "create_chapter",
  name: "Create Chapter",
  description:
    "Create a new chapter. Use when the user asks to add a chapter to the project.",
  inputSchema: z.object({
    title: z.string().min(1).describe("Chapter title"),
    synopsis: z.string().describe("Brief chapter synopsis").optional(),
  }),
  requiresApproval: true,
  async execute(params, context) {
    const chapter = await createChapter({
      projectId: context.projectId,
      title: params.title,
      synopsis: params.synopsis,
    });
    return ok(`Created chapter "${chapter.title}"`, {
      id: chapter.id,
      title: chapter.title,
    });
  },
});

export const updateChapterTool = defineTool({
  id: "update_chapter",
  name: "Update Chapter",
  description:
    "Update a chapter's title, synopsis, or status. Only include fields to change.",
  inputSchema: z.object({
    id: z.string().min(1).describe("Chapter ID"),
    title: z.string().describe("New title").optional(),
    synopsis: z.string().describe("New synopsis").optional(),
    status: ChapterStatusEnum.describe("New status").optional(),
  }),
  requiresApproval: true,
  async execute(params) {
    const { id, ...fields } = params;
    const existing = await getChapter(id as ChapterId);
    if (!existing) return fail(`Chapter not found: ${id}`);
    await updateChapter(id as ChapterId, fields);
    return ok(`Updated chapter "${existing.title}"`);
  },
});

export const searchChaptersTool = defineTool({
  id: "search_chapters",
  name: "Search Chapters",
  description:
    "Tokenized keyword search across chapter titles and content (BM25-ranked). " +
    "Throw multiple relevant keywords; chapters matching ANY term are returned, " +
    "ranked by relevance. Prefix matches and small typos are tolerated. Wrap " +
    'text in double quotes (e.g. "moonlit garden") to require an exact phrase. ' +
    "Returns matching chapter titles, IDs, and snippets.",
  inputSchema: z.object({
    query: z.string().min(1).describe("Search phrase or keywords"),
  }),
  requiresApproval: false,
  async execute(params, context) {
    const matches = await searchChaptersKeyword(
      context.projectId,
      params.query,
    );
    return ok(`Found ${matches.length} matching chapters`, { matches });
  },
});

export const readChapterTool = defineTool({
  id: "read_chapter",
  name: "Read Chapter",
  description:
    "Read the full markdown content of a chapter by ID. " +
    "For large chapters, prefer read_chapter_range or search_chapter to reduce token usage.",
  inputSchema: z.object({ id: z.string().min(1).describe("Chapter ID") }),
  requiresApproval: false,
  async execute(params) {
    const chapter = await getChapter(params.id as ChapterId);
    if (!chapter) return fail(`Chapter not found: ${params.id}`);

    return ok(`Chapter "${chapter.title}" (${chapter.wordCount} words)`, {
      id: chapter.id,
      title: chapter.title,
      content: chapter.content,
    });
  },
});

export const readChapterRangeTool = defineTool({
  id: "read_chapter_range",
  name: "Read Chapter Range",
  description:
    "Read a range of paragraphs from a chapter (1-indexed, inclusive). " +
    "Default window is 20 paragraphs, max 50. Use after `get` (category=chapter) to discover totalParagraphs.",
  inputSchema: z.object({
    id: z.string().min(1).describe("Chapter ID"),
    start: z
      .number()
      .int()
      .min(1)
      .describe("Start paragraph number (1-indexed)"),
    end: z
      .number()
      .int()
      .min(1)
      .describe(
        "End paragraph number (1-indexed, inclusive). Defaults to start + 19.",
      )
      .optional(),
  }),
  requiresApproval: false,
  async execute(params) {
    const chapter = await getChapter(params.id as ChapterId);
    if (!chapter) return fail(`Chapter not found: ${params.id}`);
    const paragraphs = splitParagraphs(chapter.content);
    const total = paragraphs.length;
    const start = Math.max(1, Math.min(params.start, total));
    const rawEnd = params.end ?? start + 19;
    const end = Math.max(start, Math.min(rawEnd, total, start + 49));
    const content = paragraphs.slice(start - 1, end).join("\n\n");
    return ok(
      `Chapter "${chapter.title}" paragraphs ${start}-${end} of ${total}`,
      {
        id: chapter.id,
        title: chapter.title,
        content,
        start,
        end,
        totalParagraphs: total,
      },
    );
  },
});

export const searchChapterTool = defineTool({
  id: "search_chapter",
  name: "Search Chapter",
  description:
    "Tokenized keyword search within a single chapter (BM25-ranked over paragraphs). " +
    "Throw multiple relevant keywords; paragraphs matching ANY term are returned, " +
    "ranked by relevance. Prefix matches and small typos are tolerated. Wrap text " +
    'in double quotes (e.g. "moonlit garden") to require an exact phrase. ' +
    "Returns matching paragraph numbers with surrounding context. " +
    "Use this instead of read_chapter when looking for a specific passage.",
  inputSchema: z.object({
    id: z.string().min(1).describe("Chapter ID"),
    query: z.string().min(1).describe("Search keywords or phrase"),
    contextParagraphs: z
      .number()
      .int()
      .min(0)
      .max(3)
      .describe(
        "Number of surrounding paragraphs to include (default 1, max 3)",
      )
      .optional(),
  }),
  requiresApproval: false,
  async execute(params) {
    const chapter = await getChapter(params.id as ChapterId);
    if (!chapter) return fail(`Chapter not found: ${params.id}`);
    const result = await searchChapterParagraphsKeyword(
      params.id as ChapterId,
      params.query,
      {
        contextParagraphs: params.contextParagraphs ?? 1,
        maxResults: 10,
      },
    );
    return ok(
      `Found ${result.matches.length} matches for "${params.query}" in "${chapter.title}"`,
      {
        id: chapter.id,
        title: chapter.title,
        matches: result.matches,
        totalMatches: result.matches.length,
      },
    );
  },
});

export const getChapterStructureTool = defineTool({
  id: "get_chapter_structure",
  name: "Get Chapter Structure",
  description:
    "Get the structural map of a chapter: scene boundaries with paragraph numbers and previews. " +
    "Use this to understand chapter layout before reading specific sections.",
  inputSchema: z.object({ id: z.string().min(1).describe("Chapter ID") }),
  requiresApproval: false,
  async execute(params) {
    const chapter = await getChapter(params.id as ChapterId);
    if (!chapter) return fail(`Chapter not found: ${params.id}`);
    const paragraphs = splitParagraphs(chapter.content);
    const scenes: { start: number; end: number; preview: string }[] = [];
    let sceneStart = 1;
    for (let i = 0; i < paragraphs.length; i++) {
      if (SCENE_BREAK_RE.test(paragraphs[i])) {
        if (i > sceneStart - 1) {
          const firstPara = paragraphs[sceneStart - 1];
          scenes.push({
            start: sceneStart,
            end: i, // paragraph before the break
            preview: firstPara.slice(0, 80),
          });
        }
        sceneStart = i + 2; // skip the break paragraph
      }
    }
    // Final scene (or the only scene if no breaks)
    if (sceneStart <= paragraphs.length) {
      const firstPara = paragraphs[sceneStart - 1];
      scenes.push({
        start: sceneStart,
        end: paragraphs.length,
        preview: firstPara.slice(0, 80),
      });
    }
    return ok(
      `Chapter "${chapter.title}": ${scenes.length} scene(s), ${paragraphs.length} paragraphs`,
      {
        id: chapter.id,
        title: chapter.title,
        totalParagraphs: paragraphs.length,
        scenes,
      },
    );
  },
});
