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
import { defineTool } from "../types";
import { fail, ok, SCENE_BREAK_RE, splitParagraphs } from "./helpers";

// CRUD: chapter create/update plus the chapter-content read tools
// (read_chapter / read_chapter_range / search_chapter / search_chapters /
// get_chapter_structure). Simple list/get-by-id use the consolidated
// `list` / `get` tools — see ./registry.ts.

export const createChapterTool = defineTool({
  id: "create_chapter",
  category: "chapter",
  name: "Create Chapter",
  description:
    "Create a new chapter. Use when the user asks to add a chapter to the project.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Chapter title" },
      synopsis: { type: "string", description: "Brief chapter synopsis" },
    },
    required: ["title"],
  },
  inputSchema: z
    .object({
      title: z.string().min(1),
      synopsis: z.string().optional(),
    })
    .strip(),
  requiresApproval: true,
  async execute(params, context) {
    const chapter = await createChapter({
      projectId: context.projectId,
      title: params.title,
      synopsis: params.synopsis ?? undefined,
    });
    return ok(`Created chapter "${chapter.title}"`, {
      id: chapter.id,
      title: chapter.title,
    });
  },
});

export const updateChapterTool = defineTool({
  id: "update_chapter",
  category: "chapter",
  name: "Update Chapter",
  description:
    "Update a chapter's title, synopsis, or status. Only include fields to change.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Chapter ID" },
      title: { type: "string", description: "New title" },
      synopsis: { type: "string", description: "New synopsis" },
      status: {
        type: "string",
        description: "New status",
        enum: ["draft", "revised", "final"],
      },
    },
    required: ["id"],
  },
  inputSchema: z
    .object({
      id: z.string().min(1),
      title: z.string().optional(),
      synopsis: z.string().optional(),
      status: ChapterStatusEnum.optional(),
    })
    .strip(),
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
  category: "chapter",
  name: "Search Chapters",
  description:
    "Tokenized keyword search across chapter titles and content (BM25-ranked). " +
    "Throw multiple relevant keywords; chapters matching ANY term are returned, " +
    "ranked by relevance. Prefix matches and small typos are tolerated. Wrap " +
    'text in double quotes (e.g. "moonlit garden") to require an exact phrase. ' +
    "Returns matching chapter titles, IDs, and snippets.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search phrase or keywords" },
    },
    required: ["query"],
  },
  inputSchema: z.object({ query: z.string().min(1) }).strip(),
  requiresApproval: false,
  async execute(params, context) {
    const matches = await searchChaptersKeyword(
      context.projectId,
      params.query,
      { readableChapterIds: context.readableChapterIds },
    );
    return ok(`Found ${matches.length} matching chapters`, { matches });
  },
});

export const readChapterTool = defineTool({
  id: "read_chapter",
  category: "chapter",
  name: "Read Chapter",
  description:
    "Read the full markdown content of a chapter by ID. " +
    "For large chapters, prefer read_chapter_range or search_chapter to reduce token usage.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Chapter ID" },
    },
    required: ["id"],
  },
  inputSchema: z.object({ id: z.string().min(1) }).strip(),
  requiresApproval: false,
  async execute(params, context) {
    const chapter = await getChapter(params.id as ChapterId);
    if (!chapter) return fail(`Chapter not found: ${params.id}`);
    if (
      context.readableChapterIds &&
      !context.readableChapterIds.has(chapter.id)
    ) {
      return fail(
        `Chapter "${chapter.title}" is beyond the current reading position; cannot read ahead in a comprehension pass.`,
      );
    }

    // Editor agents in the same tier should see staged proposed edits from
    // earlier editors so chapter N+1's editor can acknowledge chapter N's
    // new scene. Other agent kinds always see the persisted chapter content.
    if (context.agentKind === "editor" && context.runId) {
      const { getChapterWithStagedEdits } = await import(
        "@/lib/ai/agents/pipeline/stagedChapterContent"
      );
      const staged = await getChapterWithStagedEdits(
        context.runId,
        params.id as ChapterId,
      );
      if (staged) {
        return ok(
          `Chapter "${chapter.title}" (${staged.wordCount} words, with staged edits)`,
          {
            id: chapter.id,
            title: chapter.title,
            content: staged.content,
            staged: true,
          },
        );
      }
    }

    return ok(`Chapter "${chapter.title}" (${chapter.wordCount} words)`, {
      id: chapter.id,
      title: chapter.title,
      content: chapter.content,
    });
  },
});

export const readChapterRangeTool = defineTool({
  id: "read_chapter_range",
  category: "chapter",
  name: "Read Chapter Range",
  description:
    "Read a range of paragraphs from a chapter (1-indexed, inclusive). " +
    "Default window is 20 paragraphs, max 50. Use after `get` (category=chapter) to discover totalParagraphs.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Chapter ID" },
      start: {
        type: "number",
        description: "Start paragraph number (1-indexed)",
      },
      end: {
        type: "number",
        description:
          "End paragraph number (1-indexed, inclusive). Defaults to start + 19.",
      },
    },
    required: ["id", "start"],
  },
  inputSchema: z
    .object({
      id: z.string().min(1),
      start: z.number().int().min(1),
      end: z.number().int().min(1).optional(),
    })
    .strip(),
  requiresApproval: false,
  async execute(params, context) {
    const chapter = await getChapter(params.id as ChapterId);
    if (!chapter) return fail(`Chapter not found: ${params.id}`);
    if (
      context.readableChapterIds &&
      !context.readableChapterIds.has(chapter.id)
    ) {
      return fail(
        `Chapter "${chapter.title}" is beyond the current reading position; cannot read ahead in a comprehension pass.`,
      );
    }
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
  category: "chapter",
  name: "Search Chapter",
  description:
    "Tokenized keyword search within a single chapter (BM25-ranked over paragraphs). " +
    "Throw multiple relevant keywords; paragraphs matching ANY term are returned, " +
    "ranked by relevance. Prefix matches and small typos are tolerated. Wrap text " +
    'in double quotes (e.g. "moonlit garden") to require an exact phrase. ' +
    "Returns matching paragraph numbers with surrounding context. " +
    "Use this instead of read_chapter when looking for a specific passage.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Chapter ID" },
      query: { type: "string", description: "Search keywords or phrase" },
      context_paragraphs: {
        type: "number",
        description:
          "Number of surrounding paragraphs to include (default 1, max 3)",
      },
    },
    required: ["id", "query"],
  },
  inputSchema: z
    .object({
      id: z.string().min(1),
      query: z.string().min(1),
      context_paragraphs: z.number().int().min(0).max(3).optional(),
    })
    .strip(),
  requiresApproval: false,
  async execute(params, context) {
    const chapter = await getChapter(params.id as ChapterId);
    if (!chapter) return fail(`Chapter not found: ${params.id}`);
    if (
      context.readableChapterIds &&
      !context.readableChapterIds.has(chapter.id)
    ) {
      return fail(
        `Chapter "${chapter.title}" is beyond the current reading position; cannot read ahead in a comprehension pass.`,
      );
    }
    const result = await searchChapterParagraphsKeyword(
      params.id as ChapterId,
      params.query,
      {
        contextParagraphs: params.context_paragraphs ?? 1,
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
  category: "chapter",
  name: "Get Chapter Structure",
  description:
    "Get the structural map of a chapter: scene boundaries with paragraph numbers and previews. " +
    "Use this to understand chapter layout before reading specific sections.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Chapter ID" },
    },
    required: ["id"],
  },
  inputSchema: z.object({ id: z.string().min(1) }).strip(),
  requiresApproval: false,
  async execute(params, context) {
    const chapter = await getChapter(params.id as ChapterId);
    if (!chapter) return fail(`Chapter not found: ${params.id}`);
    if (
      context.readableChapterIds &&
      !context.readableChapterIds.has(chapter.id)
    ) {
      return fail(
        `Chapter "${chapter.title}" is beyond the current reading position; cannot read ahead in a comprehension pass.`,
      );
    }
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
