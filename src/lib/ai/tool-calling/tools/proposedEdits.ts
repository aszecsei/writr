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

export const proposeEditTool = defineTool({
  id: "propose_edit",
  name: "Propose Edit",
  description:
    "Propose a developmental edit to a chapter. Edits go to a STAGING table — they are not applied to the manuscript. " +
    "The human reviews and approves edits before they're committed to the chapter at tier-apply time. " +
    "kind=replace_range needs fromOffset+toOffset+anchorText. " +
    "kind=insert_at needs fromOffset+anchorText (or appended if anchorText not given). " +
    "kind=append appends to the chapter end. " +
    "kind=full_chapter replaces the whole chapter. " +
    "Always include anchorText (the exact text being replaced/inserted-near) so the edit survives concurrent rewrites.",
  parameters: {
    type: "object",
    properties: {
      workUnitId: {
        type: "string",
        description: "Work unit this edit fulfills",
      },
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
          "Exact text at the edit site — used as a fallback locator if offsets drift.",
      },
      newContent: {
        type: "string",
        description: "Replacement / inserted markdown content.",
      },
      rationale: {
        type: "string",
        description: "Why this edit fulfills the work unit's goal.",
      },
    },
    required: ["workUnitId", "chapterId", "kind", "newContent"],
  },
  inputSchema: z.object({
    workUnitId: z.string().uuid(),
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
    if (!context.runId) return fail("propose_edit requires a run context");

    const wu = await getWorkUnit(params.workUnitId);
    if (!wu) return fail(`Work unit not found: ${params.workUnitId}`);
    if (wu.runId !== context.runId)
      return fail("Work unit belongs to a different run");

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

    const edit = await createProposedEdit({
      projectId: context.projectId,
      runId: context.runId,
      workUnitId: params.workUnitId,
      chapterId: params.chapterId,
      kind: params.kind,
      fromOffset: params.fromOffset,
      toOffset: params.toOffset,
      anchorText: params.anchorText,
      newContent: params.newContent,
      rationale: params.rationale,
    });
    return ok(`Proposed ${params.kind} edit on "${chapter.title}"`, {
      proposedEditId: edit.id,
    });
  },
});
