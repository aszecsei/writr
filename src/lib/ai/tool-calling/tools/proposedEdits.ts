import { match, P } from "ts-pattern";
import { z } from "zod";
import { getChapter } from "@/db/operations/chapters";
import type { ChapterId } from "@/db/schemas";
import {
  countNormalizedOccurrences,
  normalizedIncludes,
} from "@/lib/punctuation-match";
import { defineTool } from "../types";
import type { EditLocator } from "./edit-locator";
import { fail, ok } from "./helpers";

/**
 * Apply-time safety check: is this edit's anchor still locatable in the given
 * chapter content? For `replace`, mirrors the proposal-time uniqueness gate
 * (but tolerates non-uniqueness — the chapter has likely shifted by apply
 * time, so any match is enough to enable Apply). Shared with
 * `locateProposedEdit` (`edit-locator.ts`) — that function actually resolves
 * the range; this one only answers "would it find something".
 */
export function computeAnchorFound(
  content: string,
  edit: Pick<EditLocator, "kind" | "anchorText" | "prefix" | "suffix">,
): boolean {
  return match(edit)
    .with({ kind: P.union("append", "full_chapter") }, () => true)
    .with({ kind: "replace" }, (e) =>
      normalizedIncludes(
        content,
        (e.prefix ?? "") + (e.anchorText ?? "") + (e.suffix ?? ""),
      ),
    )
    .with(
      { kind: "insert_at" },
      (e) =>
        e.anchorText !== undefined && normalizedIncludes(content, e.anchorText),
    )
    .exhaustive();
}

// ─── propose_edit ───────────────────────────────────────────────────
//
// The shape the LLM sees and the diff payload it returns are render-only: the
// tool does not persist. It returns a diff payload in `result.data` for the
// AiPanel to render with Apply / Discard controls. The user is the apply gate.
//
// `replace` locates an edit by anchorText with optional prefix/suffix
// disambiguation; the combined string `prefix + anchorText + suffix` MUST
// occur exactly once in the chapter at proposal time (uniqueness contract).

export const proposeEditTool = defineTool({
  id: "propose_edit",
  name: "Propose Edit",
  description:
    "Propose a developmental edit to a chapter. " +
    "kind=replace replaces existing text. anchorText is the verbatim text being replaced. " +
    "Use prefix/suffix (also verbatim) to disambiguate when anchorText alone repeats — the combined " +
    "prefix+anchorText+suffix must occur EXACTLY ONCE in the chapter, or the call is rejected. " +
    "kind=insert_at needs fromOffset+anchorText (or anchorText alone). " +
    "kind=append appends to the chapter end. " +
    "kind=full_chapter replaces the whole chapter.",
  inputSchema: z.object({
    chapterId: z.string().uuid().describe("Target chapter id"),
    kind: z.enum(["replace", "insert_at", "append", "full_chapter"]),
    fromOffset: z
      .number()
      .int()
      .nonnegative()
      .describe("0-indexed character offset (insert_at only).")
      .optional(),
    anchorText: z
      .string()
      .describe(
        "Required for replace (the exact text being replaced) and for insert_at (the surrounding text the insertion sits next to). Must match the chapter VERBATIM, character-for-character.",
      )
      .optional(),
    prefix: z
      .string()
      .describe(
        "replace only. Verbatim text immediately preceding anchorText, concatenated as prefix+anchorText+suffix to form a unique locator. Use only when anchorText alone repeats. Do NOT add spaces between prefix and anchorText — the substrings are concatenated as-is.",
      )
      .optional(),
    suffix: z
      .string()
      .describe(
        "replace only. Verbatim text immediately following anchorText. See prefix.",
      )
      .optional(),
    newContent: z.string().describe("Replacement / inserted markdown content."),
    rationale: z
      .string()
      .describe("One short sentence on why this edit improves the prose.")
      .optional(),
  }),
  requiresApproval: false,
  async execute(params, context) {
    const chapter = await getChapter(params.chapterId as ChapterId);
    if (!chapter) return fail(`Chapter not found: ${params.chapterId}`);
    if (chapter.projectId !== context.projectId)
      return fail("Chapter belongs to a different project");

    if (params.kind === "replace") {
      if (!params.anchorText || params.anchorText.length === 0) {
        return fail("replace requires non-empty anchorText");
      }
      const combined =
        (params.prefix ?? "") + params.anchorText + (params.suffix ?? "");
      const matches = countNormalizedOccurrences(chapter.content, combined);
      if (matches === 0) {
        return fail(
          "replace anchor not found in chapter — verify the prefix/anchorText/suffix you quoted matches the chapter verbatim (no added or normalized whitespace; curly vs straight quotes are tolerated)",
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

    // Render-only. Resolve originalText so the diff card can show a
    // before/after without re-fetching the chapter.
    const originalText = resolveOriginalText({
      kind: params.kind,
      anchorText: params.anchorText,
      chapterContent: chapter.content,
    });
    // Apply-time safety: re-check locatability so the card can disable Apply
    // if the chapter has shifted between proposal and click. For `replace`
    // proposal-time uniqueness already guaranteed a match exists, so this is
    // a guard against the chat user editing the chapter before clicking.
    const anchorFound = computeAnchorFound(chapter.content, {
      kind: params.kind,
      anchorText: params.anchorText,
      prefix: params.prefix,
      suffix: params.suffix,
    });

    return ok(`Proposed ${params.kind} edit on "${chapter.title}"`, {
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
