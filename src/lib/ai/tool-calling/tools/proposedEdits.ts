import { z } from "zod";
import { getChapter } from "@/db/operations/chapters";
import { createProposedEdit } from "@/db/operations/proposedEdits";
import { getWorkUnit } from "@/db/operations/workUnits";
import { defineTool, type ToolResult } from "../types";

function ok(message: string, data?: Record<string, unknown>): ToolResult {
  return { success: true, message, data };
}

function fail(message: string): ToolResult {
  return { success: false, message };
}

// ─── propose_edit ───────────────────────────────────────────────────
//
// Dual-mode tool. The shape the LLM sees is identical in both modes; the
// runtime branches on `context.workUnitId`:
//   • Pipeline mode (workUnitId set): writes to the proposedEdits staging
//     table for the orchestrator's tier-apply step to commit.
//   • Chat mode (workUnitId absent): does not persist. Returns a diff
//     payload in `result.data` for the AiPanel to render with Apply /
//     Discard controls. The user is the apply gate.

export const proposeEditTool = defineTool({
  id: "propose_edit",
  name: "Propose Edit",
  description:
    "Propose a developmental edit to a chapter. " +
    "kind=replace_range needs fromOffset+toOffset+anchorText. " +
    "kind=insert_at needs fromOffset+anchorText (or anchorText alone if you can't compute the offset). " +
    "kind=append appends to the chapter end. " +
    "kind=full_chapter replaces the whole chapter. " +
    "Always include anchorText (the exact text being replaced or inserted next to) — it's the primary locator and must match the chapter verbatim.",
  parameters: {
    type: "object",
    properties: {
      chapterId: { type: "string", description: "Target chapter id" },
      kind: {
        type: "string",
        enum: ["replace_range", "insert_at", "append", "full_chapter"],
      },
      fromOffset: {
        type: "number",
        description:
          "0-indexed character offset (for replace_range / insert_at)",
      },
      toOffset: {
        type: "number",
        description: "Exclusive end offset (for replace_range)",
      },
      anchorText: {
        type: "string",
        description:
          "Exact text at the edit site — used as the primary locator. Required for replace_range and insert_at.",
      },
      newContent: {
        type: "string",
        description: "Replacement / inserted markdown content.",
      },
      rationale: {
        type: "string",
        description: "One short sentence on why this edit improves the prose.",
      },
    },
    required: ["chapterId", "kind", "newContent"],
  },
  inputSchema: z.object({
    chapterId: z.string().uuid(),
    kind: z.enum(["replace_range", "insert_at", "append", "full_chapter"]),
    fromOffset: z.number().int().nonnegative().optional(),
    toOffset: z.number().int().nonnegative().optional(),
    anchorText: z.string().optional(),
    newContent: z.string(),
    rationale: z.string().optional(),
  }),
  requiresApproval: false,
  async execute(params, context) {
    const chapter = await getChapter(params.chapterId);
    if (!chapter) return fail(`Chapter not found: ${params.chapterId}`);
    if (chapter.projectId !== context.projectId)
      return fail("Chapter belongs to a different project");

    if (params.kind === "replace_range") {
      if (params.fromOffset === undefined || params.toOffset === undefined) {
        return fail("replace_range requires fromOffset and toOffset");
      }
      if (params.fromOffset > params.toOffset) {
        return fail("fromOffset must be <= toOffset");
      }
    }
    if (params.kind === "insert_at" && params.fromOffset === undefined) {
      // We allow insert_at without an explicit offset when anchorText is set —
      // the apply step will search for the anchor.
      if (!params.anchorText) {
        return fail(
          "insert_at requires either fromOffset or anchorText to locate the insertion point",
        );
      }
    }

    // Pipeline mode: stage the edit for tier-apply.
    if (context.workUnitId) {
      if (!context.runId) return fail("propose_edit requires a run context");

      const wu = await getWorkUnit(context.workUnitId);
      if (!wu) return fail(`Work unit not found: ${context.workUnitId}`);
      if (wu.runId !== context.runId)
        return fail("Work unit belongs to a different run");

      const edit = await createProposedEdit({
        projectId: context.projectId,
        runId: context.runId,
        workUnitId: context.workUnitId,
        chapterId: params.chapterId,
        kind: params.kind,
        fromOffset: params.fromOffset,
        toOffset: params.toOffset,
        anchorText: params.anchorText,
        newContent: params.newContent,
        rationale: params.rationale,
      });
      return ok(`Proposed ${params.kind} edit on "${chapter.title}"`, {
        mode: "pipeline",
        proposedEditId: edit.id,
      });
    }

    // Chat mode: render-only. Resolve originalText so the diff card can
    // show a before/after without re-fetching the chapter.
    const originalText = resolveOriginalText({
      kind: params.kind,
      anchorText: params.anchorText,
      chapterContent: chapter.content,
    });
    const anchorFound =
      params.kind === "append" ||
      params.kind === "full_chapter" ||
      (params.anchorText !== undefined &&
        chapter.content.includes(params.anchorText));

    return ok(`Proposed ${params.kind} edit on "${chapter.title}"`, {
      mode: "chat",
      chapterId: params.chapterId,
      chapterTitle: chapter.title,
      kind: params.kind,
      anchorText: params.anchorText,
      newContent: params.newContent,
      rationale: params.rationale,
      originalText,
      anchorFound,
    });
  },
});

function resolveOriginalText(args: {
  kind: "replace_range" | "insert_at" | "append" | "full_chapter";
  anchorText?: string;
  chapterContent: string;
}): string {
  switch (args.kind) {
    case "full_chapter":
      return args.chapterContent;
    case "replace_range":
      return args.anchorText ?? "";
    case "insert_at":
    case "append":
      return "";
  }
}
