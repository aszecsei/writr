import { match, P } from "ts-pattern";
import { z } from "zod";
import { getChapter } from "@/db/operations/chapters";
import { createProposedEdit } from "@/db/operations/proposedEdits";
import { getWorkUnit } from "@/db/operations/workUnits";
import { defineTool } from "../types";
import { fail, ok } from "./helpers";

// ─── propose_edit ───────────────────────────────────────────────────
//
// Dual-mode tool. The shape the LLM sees is identical in both modes; the
// runtime branches on `context.workUnitId`:
//   • Pipeline mode (workUnitId set): writes to the proposedEdits staging
//     table for the orchestrator's tier-apply step to commit.
//   • Chat mode (workUnitId absent): does not persist. Returns a diff
//     payload in `result.data` for the AiPanel to render with Apply /
//     Discard controls. The user is the apply gate.
//
// `replace` locates an edit by anchorText with optional prefix/suffix
// disambiguation; the combined string `prefix + anchorText + suffix` MUST
// occur exactly once in the chapter at proposal time (uniqueness contract).

export const proposeEditTool = defineTool({
  id: "propose_edit",
  category: "edit",
  name: "Propose Edit",
  description:
    "Propose a developmental edit to a chapter. " +
    "kind=replace replaces existing text. anchorText is the verbatim text being replaced. " +
    "Use prefix/suffix (also verbatim) to disambiguate when anchorText alone repeats — the combined " +
    "prefix+anchorText+suffix must occur EXACTLY ONCE in the chapter, or the call is rejected. " +
    "kind=insert_at needs fromOffset+anchorText (or anchorText alone). " +
    "kind=append appends to the chapter end. " +
    "kind=full_chapter replaces the whole chapter.",
  parameters: {
    type: "object",
    properties: {
      chapterId: { type: "string", description: "Target chapter id" },
      kind: {
        type: "string",
        enum: ["replace", "insert_at", "append", "full_chapter"],
      },
      anchorText: {
        type: "string",
        description:
          "Required for replace (the exact text being replaced) and for insert_at (the surrounding text the insertion sits next to). Must match the chapter VERBATIM, character-for-character.",
      },
      prefix: {
        type: "string",
        description:
          "replace only. Verbatim text immediately preceding anchorText, concatenated as prefix+anchorText+suffix to form a unique locator. Use only when anchorText alone repeats. Do NOT add spaces between prefix and anchorText — the substrings are concatenated as-is.",
      },
      suffix: {
        type: "string",
        description:
          "replace only. Verbatim text immediately following anchorText. See prefix.",
      },
      fromOffset: {
        type: "number",
        description: "0-indexed character offset (insert_at only).",
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
    kind: z.enum(["replace", "insert_at", "append", "full_chapter"]),
    fromOffset: z.number().int().nonnegative().optional(),
    anchorText: z.string().optional(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    newContent: z.string(),
    rationale: z.string().optional(),
  }),
  requiresApproval: false,
  async execute(params, context) {
    const chapter = await getChapter(params.chapterId);
    if (!chapter) return fail(`Chapter not found: ${params.chapterId}`);
    if (chapter.projectId !== context.projectId)
      return fail("Chapter belongs to a different project");

    if (params.kind === "replace") {
      if (!params.anchorText || params.anchorText.length === 0) {
        return fail("replace requires non-empty anchorText");
      }
      const combined =
        (params.prefix ?? "") + params.anchorText + (params.suffix ?? "");
      const matches = countOccurrences(chapter.content, combined);
      if (matches === 0) {
        return fail(
          "replace anchor not found in chapter — verify the prefix/anchorText/suffix you quoted matches the chapter verbatim (no added or normalized whitespace)",
        );
      }
      if (matches > 1) {
        return fail(
          `replace anchor is not unique (found ${matches} matches) — widen prefix and/or suffix until the combination occurs exactly once`,
        );
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
        anchorText: params.anchorText,
        prefix: params.prefix,
        suffix: params.suffix,
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
    // Apply-time safety: re-check locatability so the card can disable Apply
    // if the chapter has shifted between proposal and click. For `replace`
    // proposal-time uniqueness already guaranteed a match exists, so this is
    // a guard against the chat user editing the chapter before clicking.
    const anchorFound = match(params)
      .with({ kind: P.union("append", "full_chapter") }, () => true)
      .with({ kind: "replace" }, (p) =>
        chapter.content.includes(
          (p.prefix ?? "") + (p.anchorText ?? "") + (p.suffix ?? ""),
        ),
      )
      .with(
        { kind: "insert_at" },
        (p) =>
          p.anchorText !== undefined && chapter.content.includes(p.anchorText),
      )
      .exhaustive();

    return ok(`Proposed ${params.kind} edit on "${chapter.title}"`, {
      mode: "chat",
      chapterId: params.chapterId,
      chapterTitle: chapter.title,
      kind: params.kind,
      anchorText: params.anchorText,
      prefix: params.prefix,
      suffix: params.suffix,
      newContent: params.newContent,
      rationale: params.rationale,
      originalText,
      anchorFound,
    });
  },
});

function resolveOriginalText(args: {
  kind: "replace" | "insert_at" | "append" | "full_chapter";
  anchorText?: string;
  chapterContent: string;
}): string {
  return match(args)
    .with({ kind: "full_chapter" }, (a) => a.chapterContent)
    .with({ kind: "replace" }, (a) => a.anchorText ?? "")
    .with({ kind: P.union("insert_at", "append") }, () => "")
    .exhaustive();
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx < 0) return count;
    count++;
    from = idx + needle.length;
  }
}
