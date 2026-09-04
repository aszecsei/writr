import { z } from "zod";
import { getChapter } from "@/db/operations/chapters";
import { createComment, getComment } from "@/db/operations/comments";
import type { ChapterId, CommentId } from "@/db/schemas";
import {
  BETA_READER_PERSONA_ATTRIBUTION,
  type BetaReaderPersonaId,
} from "@/lib/ai/agents/builtins/betaReader";
import { countNormalizedOccurrences } from "@/lib/punctuation-match";
import { defineTool } from "../types";
import { fail, ok } from "./helpers";

// ─── Shared persona handling ────────────────────────────────────────

const PersonaEnum = z.enum(["maya", "anton", "joan"]);

interface PersonaStamp {
  author: string;
  authorColor: string;
  color: import("@/db/schemas").CommentColor;
}

function stampForPersona(persona: BetaReaderPersonaId): PersonaStamp {
  const a = BETA_READER_PERSONA_ATTRIBUTION[persona];
  return { author: a.name, authorColor: a.authorColor, color: a.color };
}

// ─── add_comment ────────────────────────────────────────────────────
//
// Selection-only comment creation. Uses the same prefix+anchorText+suffix
// uniqueness contract as `propose_edit` — the combined string must occur
// exactly once in the chapter, with curly/straight-quote tolerance via
// `countNormalizedOccurrences`. No character ranges (`fromOffset` is not
// model-controlled); position is derived from the located anchor.
//
// Position note: `fromOffset` / `toOffset` are stored as markdown character
// offsets, not true ProseMirror positions. The Comments extension renders
// them as PM positions (off by a small constant per block boundary), so
// highlights will be a few characters off in chapters with many blocks
// preceding the anchor. `anchorText` is always stored so a future
// doc-aware reconcile pass can correct them at render time.

export const addCommentTool = defineTool({
  id: "add_comment",
  name: "Add Comment",
  description:
    "Drop an inline comment on a specific span of chapter text. " +
    "anchorText is the verbatim text the comment attaches to. " +
    "Use prefix/suffix (also verbatim) to disambiguate when anchorText alone " +
    "repeats — the combined prefix+anchorText+suffix must occur EXACTLY ONCE " +
    "in the chapter, or the call is rejected. " +
    "persona stamps the comment with the beta-reader author + color. " +
    "Always selection comments (anchorText is highlighted); no point comments.",
  inputSchema: z.object({
    chapterId: z.string().min(1).describe("Target chapter id"),
    anchorText: z
      .string()
      .min(1)
      .describe(
        "The exact text the comment attaches to. Must match the chapter VERBATIM, character-for-character (curly vs straight quotes are tolerated).",
      ),
    prefix: z
      .string()
      .describe(
        "Verbatim text immediately preceding anchorText, concatenated as prefix+anchorText+suffix to form a unique locator. Use only when anchorText alone repeats. Do NOT add spaces between prefix and anchorText — the substrings are concatenated as-is.",
      )
      .optional(),
    suffix: z
      .string()
      .describe("Verbatim text immediately following anchorText. See prefix.")
      .optional(),
    content: z
      .string()
      .min(1)
      .describe("The comment body — your reaction or observation."),
    persona: PersonaEnum.describe(
      "Which beta-reader persona is leaving this comment. Must match the XML block you are currently inside.",
    ),
  }),
  requiresApproval: false,
  async execute(params, context) {
    const chapter = await getChapter(params.chapterId as ChapterId);
    if (!chapter) return fail(`Chapter not found: ${params.chapterId}`);
    if (chapter.projectId !== context.projectId)
      return fail("Chapter belongs to a different project");

    const prefix = params.prefix ?? "";
    const suffix = params.suffix ?? "";
    const combined = prefix + params.anchorText + suffix;

    const matches = countNormalizedOccurrences(chapter.content, combined);
    if (matches === 0) {
      return fail(
        "comment anchor not found in chapter — verify the prefix/anchorText/suffix you quoted matches the chapter verbatim (no added or normalized whitespace; curly vs straight quotes are tolerated)",
      );
    }
    if (matches > 1) {
      return fail(
        `comment anchor is not unique (found ${matches} matches) — widen prefix and/or suffix until the combination occurs exactly once`,
      );
    }

    const stamp = stampForPersona(params.persona);
    // We treat `anchorText` as the source of truth (same model as
    // `propose_edit`, which stores no positions and re-locates the snippet
    // at apply time). The Comment table requires `fromOffset`/`toOffset`
    // for the editor extension, but with no live editor here we can't
    // compute true PM positions from markdown without re-implementing the
    // markdown→PM walk. Write a clamped placeholder; `reconcileComment`
    // resolves the real PM positions from `anchorText` via
    // `findAnchorPositionInDoc` the moment the chapter opens in the
    // editor, and persists the corrected offsets back to Dexie. The
    // placeholder span (`1` → `1 + anchorText.length`) gives the
    // pre-reconcile render a sensible width if the user happens to look
    // before reconcile runs.
    const fromOffset = 1;
    const toOffset = 1 + params.anchorText.length;

    const created = await createComment({
      projectId: context.projectId,
      chapterId: params.chapterId as ChapterId,
      fromOffset,
      toOffset,
      anchorText: params.anchorText,
      content: params.content,
      color: stamp.color,
      author: stamp.author,
      authorColor: stamp.authorColor,
    });

    return ok(`Added ${stamp.author} comment on "${chapter.title}"`, {
      commentId: created.id,
      persona: params.persona,
    });
  },
});

// ─── reply_to_comment ───────────────────────────────────────────────
//
// Replies inherit position and anchorText from the root. Flat threads only
// — a reply's parent must itself be a root (`parentCommentId === null`).
// This keeps the UI simple (parent + one level of replies) and prevents
// the model from spawning multi-level trees the editor would have to
// re-design to display.

export const replyToCommentTool = defineTool({
  id: "reply_to_comment",
  name: "Reply to Comment",
  description:
    "Add a reply to an existing comment. The reply inherits position from " +
    "the parent (no anchor needed). The parent must be a root comment, not " +
    "itself a reply. persona stamps the reply with the beta-reader author " +
    "+ color matching the XML block you are inside.",
  inputSchema: z.object({
    parentCommentId: z
      .string()
      .min(1)
      .describe(
        "The id of the comment you are replying to. Must be a root comment, not a reply.",
      ),
    content: z.string().min(1).describe("The reply body."),
    persona: PersonaEnum.describe(
      "Which beta-reader persona is leaving this reply. Must match the XML block you are currently inside.",
    ),
  }),
  requiresApproval: false,
  async execute(params, context) {
    const parent = await getComment(params.parentCommentId as CommentId);
    if (!parent)
      return fail(`parent comment not found: ${params.parentCommentId}`);
    if (parent.projectId !== context.projectId)
      return fail("parent comment belongs to a different project");
    if (parent.parentCommentId !== null) {
      return fail(
        "cannot reply to a reply — pick the root comment of the thread (parentCommentId must point at a root comment, not another reply)",
      );
    }

    const stamp = stampForPersona(params.persona);
    const created = await createComment({
      projectId: context.projectId,
      chapterId: parent.chapterId,
      fromOffset: parent.fromOffset,
      toOffset: parent.toOffset,
      anchorText: parent.anchorText,
      content: params.content,
      color: stamp.color,
      author: stamp.author,
      authorColor: stamp.authorColor,
      parentCommentId: parent.id,
    });

    return ok(`Replied as ${stamp.author}`, {
      commentId: created.id,
      parentCommentId: parent.id,
      persona: params.persona,
    });
  },
});
