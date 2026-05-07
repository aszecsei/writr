import { match } from "ts-pattern";
import { getChapter } from "@/db/operations/chapters";
import { listApprovedEditsForChapter } from "@/db/operations/proposedEdits";
import type {
  AgentRunId,
  ChapterId,
  ProposedEdit,
  ProposedEditId,
} from "@/db/schemas";

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
    working =
      working.slice(0, range.from) + edit.newContent + working.slice(range.to);
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
 * Resolve a proposed edit's range against the given chapter content.
 * Returns null if the locator can't be matched (anchor drift, missing anchor).
 *
 * Used both by `applyEditsToContent` (apply path) and by `EditDiffCard` (UI
 * preview). For `insert_at`, prefers the recorded offset when it still
 * matches the anchor and falls back to indexOf otherwise.
 */
export function locateProposedEdit(
  content: string,
  edit: ProposedEdit,
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
        if (slice === e.anchorText) {
          return { from: e.fromOffset, to: e.fromOffset };
        }
      }
      if (e.anchorText) {
        const idx = content.indexOf(e.anchorText);
        if (idx >= 0) return { from: idx, to: idx };
      }
      return null;
    })
    .with({ kind: "replace" }, (e): ResolvedRange | null => {
      // Uniqueness was the proposal-time guarantee; the chapter has likely
      // shifted by apply time, so first match is the best we can do.
      const combined = (e.prefix ?? "") + e.anchorText + (e.suffix ?? "");
      const idx = content.indexOf(combined);
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
  return { content, wordCount: countWords(content) };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
