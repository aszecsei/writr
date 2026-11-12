import { z } from "zod";
import {
  createChapter,
  deleteChapter,
  getBinderItems,
  getChapter,
  setChapterContent,
  updateChapter,
} from "@/db/operations/chapters";
import type { Chapter, ChapterId } from "@/db/schemas";
import { reseedIfActive } from "@/lib/editor/reseed-if-active";
import { wordsOf } from "@/lib/text/words-of";
import {
  defineTool,
  type ToolExecutionContext,
  type ToolResult,
} from "../types";
import { fail, ok } from "./helpers";

// Read / write / delete for the binder's Scratchpad section: loose notes that
// never compile and never count toward the manuscript. Every tool resolves its
// target through `loadScratchpadDoc`, so none of them can reach a manuscript
// chapter or a separator.

async function loadScratchpadDoc(
  id: string,
  context: ToolExecutionContext,
): Promise<Chapter | ToolResult> {
  const doc = await getChapter(id as ChapterId);
  if (
    !doc ||
    doc.projectId !== context.projectId ||
    doc.section !== "scratchpad" ||
    doc.kind !== "document"
  ) {
    return fail(`Scratchpad document not found: ${id}`);
  }
  return doc;
}

function isToolResult(value: Chapter | ToolResult): value is ToolResult {
  return "success" in value;
}

export const readScratchpadTool = defineTool({
  id: "read_scratchpad",
  name: "Read Scratchpad",
  description:
    "Read the project's Scratchpad: the writer's loose notes, which are not " +
    "part of the manuscript. Omit `id` to list every scratchpad document " +
    "(id, title, wordCount, parentId). Pass `id` to read one document's full " +
    "content (markdown, or Fountain in screenplay projects). For long docs, " +
    "read_chapter_range and search_chapter also accept scratchpad ids.",
  inputSchema: z.object({
    id: z
      .string()
      .min(1)
      .describe("Scratchpad document id. Omit to list all documents.")
      .optional(),
  }),
  requiresApproval: false,
  async execute(params, context) {
    if (params.id === undefined) {
      const docs = (
        await getBinderItems(context.projectId, "scratchpad")
      ).filter((c) => c.kind === "document");
      return ok(`Found ${docs.length} scratchpad documents`, {
        entries: docs.map((d) => ({
          id: d.id,
          title: d.title,
          wordCount: d.wordCount,
          parentId: d.parentChapterId,
        })),
      });
    }
    const doc = await loadScratchpadDoc(params.id, context);
    if (isToolResult(doc)) return doc;
    return ok(`Scratchpad "${doc.title}" (${doc.wordCount} words)`, {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      wordCount: doc.wordCount,
    });
  },
});

export const writeScratchpadTool = defineTool({
  id: "write_scratchpad",
  name: "Write Scratchpad",
  description:
    "Create or update a document in the project's Scratchpad (loose notes, " +
    "never compiled into the manuscript). Omit `id` to create a new document " +
    "(`title` required; `parentId` nests it under another scratchpad doc). " +
    "Pass `id` to update an existing one: `mode` 'replace' (default) " +
    "overwrites the content, 'append' adds it after the existing content. " +
    "Content is markdown, or Fountain in screenplay projects. Only works on " +
    "scratchpad documents — use read_scratchpad to discover ids.",
  inputSchema: z.object({
    id: z
      .string()
      .min(1)
      .describe("Scratchpad document id to update. Omit to create a new one.")
      .optional(),
    title: z
      .string()
      .min(1)
      .describe("Title. Required when creating; renames when updating.")
      .optional(),
    content: z.string().describe("Document body"),
    mode: z
      .enum(["replace", "append"])
      .describe("Update mode when `id` is given (default replace)")
      .optional(),
    parentId: z
      .string()
      .min(1)
      .describe("When creating: scratchpad doc id to nest under")
      .optional(),
  }),
  requiresApproval: true,
  async execute(params, context) {
    if (params.id === undefined) {
      if (!params.title)
        return fail("A title is required to create a document");
      let parentChapterId: ChapterId | null = null;
      if (params.parentId !== undefined) {
        const parent = await loadScratchpadDoc(params.parentId, context);
        if (isToolResult(parent)) return parent;
        parentChapterId = parent.id;
      }
      const doc = await createChapter({
        projectId: context.projectId,
        title: params.title,
        section: "scratchpad",
        parentChapterId,
      });
      const wordCount = wordsOf(params.content).length;
      await setChapterContent(doc.id, params.content, wordCount);
      return ok(`Created scratchpad document "${doc.title}"`, {
        id: doc.id,
        title: doc.title,
        wordCount,
      });
    }

    const doc = await loadScratchpadDoc(params.id, context);
    if (isToolResult(doc)) return doc;
    const content =
      params.mode === "append" && doc.content
        ? `${doc.content}\n\n${params.content}`
        : params.content;
    const wordCount = wordsOf(content).length;
    await setChapterContent(doc.id, content, wordCount);
    if (params.title !== undefined) {
      await updateChapter(doc.id, { title: params.title });
    }
    reseedIfActive(doc.id);
    const title = params.title ?? doc.title;
    return ok(`Updated scratchpad document "${title}"`, {
      id: doc.id,
      title,
      wordCount,
    });
  },
});

export const deleteScratchpadTool = defineTool({
  id: "delete_scratchpad",
  name: "Delete Scratchpad",
  description:
    "Delete a document from the project's Scratchpad. Any nested child " +
    "documents move up to the deleted doc's parent (they are NOT deleted). " +
    "Only works on scratchpad documents — use read_scratchpad to confirm the id.",
  inputSchema: z.object({
    id: z.string().min(1).describe("Scratchpad document id"),
  }),
  requiresApproval: true,
  async execute(params, context) {
    const doc = await loadScratchpadDoc(params.id, context);
    if (isToolResult(doc)) return doc;
    await deleteChapter(doc.id, "promote");
    return ok(`Deleted scratchpad document "${doc.title}"`);
  },
});
