import { z } from "zod";
import {
  getChapterSummary,
  hashChapterContent,
  upsertChapterSummary,
} from "@/db/operations/chapterSummaries";
import { getChapter } from "@/db/operations/chapters";
import { getAppSettings } from "@/db/operations/settings";
import { defineTool, type ToolResult } from "../types";

function ok(message: string, data?: Record<string, unknown>): ToolResult {
  return { success: true, message, data };
}

function fail(message: string): ToolResult {
  return { success: false, message };
}

// ─── read_summary ───────────────────────────────────────────────────

export const readSummaryTool = defineTool({
  id: "read_summary",
  name: "Read Chapter Summary",
  description:
    "Returns a cached short summary of a chapter (computes one if missing or stale). " +
    "Prefer this over read_chapter when you only need the gist — saves significant tokens.",
  parameters: {
    type: "object",
    properties: {
      chapterId: { type: "string", description: "Chapter id" },
    },
    required: ["chapterId"],
  },
  inputSchema: z.object({
    chapterId: z.string().uuid(),
  }),
  requiresApproval: false,
  async execute(params, context) {
    const chapter = await getChapter(params.chapterId);
    if (!chapter) return fail(`Chapter not found: ${params.chapterId}`);
    if (chapter.projectId !== context.projectId)
      return fail("Chapter belongs to a different project");

    const hash = await hashChapterContent(chapter.content);
    const cached = await getChapterSummary(params.chapterId, hash);
    if (cached) {
      return ok(`Cached summary for "${chapter.title}"`, {
        chapterId: chapter.id,
        title: chapter.title,
        summary: cached.summary,
        cached: true,
      });
    }

    // Cache miss: synthesize a summary via a one-shot model call. We use the
    // global default model (no per-agent override here — summaries are a
    // utility, not part of the agent's reasoning chain).
    const settings = await getAppSettings();
    const apiKey = settings.providerApiKeys[settings.aiProvider];
    if (!apiKey) {
      return fail(
        "Cannot compute summary: no API key configured for the active provider.",
      );
    }

    const requestBody = {
      apiKey,
      model: settings.providerModels[settings.aiProvider],
      provider: settings.aiProvider,
      messages: [
        {
          role: "system" as const,
          content:
            "You produce concise (3-5 sentence) summaries of fiction chapters. Capture the key plot beats, character developments, and any setups/payoffs. No commentary — just the summary.",
        },
        {
          role: "user" as const,
          content: `<chapter title="${chapter.title}">\n${chapter.content}\n</chapter>`,
        },
      ],
      temperature: 0.3,
      max_tokens: 512,
      stream: false,
    };

    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return fail(
        err.details ??
          err.error ??
          `Summary request failed (${response.status})`,
      );
    }
    const data = (await response.json()) as { content?: string };
    const summary = (data.content ?? "").trim();
    if (!summary) {
      return fail("Model returned an empty summary");
    }

    const row = await upsertChapterSummary({
      projectId: chapter.projectId,
      chapterId: chapter.id,
      sourceContentHash: hash,
      summary,
    });
    return ok(`Generated summary for "${chapter.title}"`, {
      chapterId: chapter.id,
      title: chapter.title,
      summary: row.summary,
      cached: false,
    });
  },
});
