import { match } from "ts-pattern";
import { getAppSettings } from "@/db/operations";
import { getChapter } from "@/db/operations/chapters";
import { listApprovedEditsForChapter } from "@/db/operations/proposedEdits";
import type {
  AgentRunId,
  ChapterId,
  ProposedEdit,
  ProposedEditId,
} from "@/db/schemas";
import { countWordsExcludingHoles } from "@/lib/holes";
import {
  normalizedIndexOf,
  normalizePunctuation,
} from "@/lib/punctuation-match";

/**
 * Apply a list of proposed edits to a chapter content string. Locates each
 * edit against the original (unmutated) `content`, then applies them in
 * descending position order so earlier splices don't perturb later ones.
 *
 * Returns:
 *   - `content`: the patched string
 *   - `applied`: edit ids that were successfully applied
 *   - `skipped`: edit ids that couldn't be located (anchor drift)
 *
 * Used both by `getChapterWithStagedEdits` (read-only overlay for editor
 * agents) and by `applyTier` (final commit). Pure — no DB writes.
 *
 * Overlapping edits are not handled — if two edits' ranges overlap, the
 * result is undefined. We treat non-overlap as an invariant of the proposal
 * step (different work units shouldn't target the same span).
 */
export function applyEditsToContent(
  content: string,
  edits: ProposedEdit[],
): { content: string; applied: ProposedEditId[]; skipped: ProposedEditId[] } {
  const skipped: ProposedEditId[] = [];
  const located: { edit: ProposedEdit; range: ResolvedRange }[] = [];

  // First pass: resolve every edit against the original content. `replace`
  // has no offsets, so we can't sort before locating.
  for (const edit of edits) {
    const range = locateProposedEdit(content, edit);
    if (!range) {
      skipped.push(edit.id);
      continue;
    }
    located.push({ edit, range });
  }

  // Apply right-to-left so earlier ranges stay valid as later portions splice.
  located.sort((a, b) => b.range.from - a.range.from);

  let working = content;
  const applied: ProposedEditId[] = [];
  for (const { edit, range } of located) {
    working = spliceEdit(working, range, edit.newContent);
    applied.push(edit.id);
  }
  // Preserve the order in which edits were located (i.e. input order minus
  // skipped) so callers can correlate ids back to their inputs.
  applied.reverse();

  return { content: working, applied, skipped };
}

export interface ResolvedRange {
  from: number;
  to: number;
}

/**
 * The locating fields shared by a persisted `ProposedEdit` (pipeline) and a
 * `PendingStagedEdit` (chat-mode Apply). `locateProposedEdit` reads only these,
 * so both shapes are accepted via structural assignability — keeping a single
 * source of truth for where an edit lands. `ProposedEdit` is a superset and is
 * passed directly; the chat consumer passes its store object.
 */
export interface EditLocator {
  kind: "replace" | "insert_at" | "append" | "full_chapter";
  anchorText?: string;
  prefix?: string;
  suffix?: string;
  fromOffset?: number;
}

/**
 * Splice `newContent` into `content` over a resolved range. Shared by the
 * pipeline apply (`applyEditsToContent`) and the chat-mode Apply consumer so
 * the splice arithmetic lives in one place.
 */
export function spliceEdit(
  content: string,
  range: ResolvedRange,
  newContent: string,
): string {
  return content.slice(0, range.from) + newContent + content.slice(range.to);
}

/**
 * Resolve a proposed edit's range against the given chapter content.
 * Returns null if the locator can't be matched (anchor drift, missing anchor).
 *
 * Used by `applyEditsToContent` (pipeline apply), the chat-mode Apply consumer
 * in `ChapterEditor`, and `EditDiffCard` (UI preview). For `insert_at`, prefers
 * the recorded offset when it still matches the anchor and falls back to
 * indexOf otherwise.
 */
export function locateProposedEdit(
  content: string,
  edit: EditLocator,
): ResolvedRange | null {
  return match(edit)
    .with({ kind: "full_chapter" }, () => ({ from: 0, to: content.length }))
    .with({ kind: "append" }, () => ({
      from: content.length,
      to: content.length,
    }))
    .with({ kind: "insert_at" }, (e): ResolvedRange | null => {
      if (
        typeof e.fromOffset === "number" &&
        e.fromOffset >= 0 &&
        e.fromOffset <= content.length
      ) {
        if (!e.anchorText) {
          return { from: e.fromOffset, to: e.fromOffset };
        }
        const slice = content.slice(
          e.fromOffset,
          e.fromOffset + e.anchorText.length,
        );
        if (
          normalizePunctuation(slice) === normalizePunctuation(e.anchorText)
        ) {
          return { from: e.fromOffset, to: e.fromOffset };
        }
      }
      if (e.anchorText) {
        const idx = normalizedIndexOf(content, e.anchorText);
        if (idx >= 0) return { from: idx, to: idx };
      }
      return null;
    })
    .with({ kind: "replace" }, (e): ResolvedRange | null => {
      if (!e.anchorText) return null;
      // Uniqueness was the proposal-time guarantee; the chapter has likely
      // shifted by apply time, so first match is the best we can do.
      const combined = (e.prefix ?? "") + e.anchorText + (e.suffix ?? "");
      const idx = normalizedIndexOf(content, combined);
      if (idx < 0) return null;
      const from = idx + (e.prefix ?? "").length;
      return { from, to: from + e.anchorText.length };
    })
    .exhaustive();
}

/**
 * Read a chapter's content overlaid with all `approved` edits for the same
 * run. Used by `read_chapter` when invoked from an editor agent so a later
 * editor in the same tier sees the earlier editor's staged work.
 */
export async function getChapterWithStagedEdits(
  runId: AgentRunId,
  chapterId: ChapterId,
): Promise<{ content: string; wordCount: number } | null> {
  const chapter = await getChapter(chapterId);
  if (!chapter) return null;
  const approved = await listApprovedEditsForChapter(runId, chapterId);
  if (approved.length === 0) {
    return { content: chapter.content, wordCount: chapter.wordCount };
  }
  const { content } = applyEditsToContent(chapter.content, approved);
  const { holeDelimiters } = await getAppSettings();
  return {
    content,
    wordCount: countWordsExcludingHoles(content, holeDelimiters),
  };
}
