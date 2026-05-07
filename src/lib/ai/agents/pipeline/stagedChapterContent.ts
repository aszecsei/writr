import { getChapter } from "@/db/operations/chapters";
import { listApprovedEditsForChapter } from "@/db/operations/proposedEdits";
import type { ProposedEdit } from "@/db/schemas";

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
): { content: string; applied: string[]; skipped: string[] } {
  const skipped: string[] = [];
  const located: { edit: ProposedEdit; range: ResolvedRange }[] = [];

  // First pass: resolve every edit against the original content. `replace`
  // has no offsets, so we can't sort before locating.
  for (const edit of edits) {
    const range = locateEdit(content, edit);
    if (!range) {
      skipped.push(edit.id);
      continue;
    }
    located.push({ edit, range });
  }

  // Apply right-to-left so earlier ranges stay valid as later portions splice.
  located.sort((a, b) => b.range.from - a.range.from);

  let working = content;
  const applied: string[] = [];
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

interface ResolvedRange {
  from: number;
  to: number;
}

function locateEdit(content: string, edit: ProposedEdit): ResolvedRange | null {
  switch (edit.kind) {
    case "full_chapter":
      return { from: 0, to: content.length };
    case "append":
      return { from: content.length, to: content.length };
    case "insert_at": {
      // Prefer recorded offset if it still matches the anchor (or is empty);
      // otherwise search for the anchor.
      if (
        typeof edit.fromOffset === "number" &&
        edit.fromOffset >= 0 &&
        edit.fromOffset <= content.length
      ) {
        if (!edit.anchorText) {
          return { from: edit.fromOffset, to: edit.fromOffset };
        }
        const slice = content.slice(
          edit.fromOffset,
          edit.fromOffset + edit.anchorText.length,
        );
        if (slice === edit.anchorText) {
          return { from: edit.fromOffset, to: edit.fromOffset };
        }
      }
      if (edit.anchorText) {
        const idx = content.indexOf(edit.anchorText);
        if (idx >= 0) return { from: idx, to: idx };
      }
      return null;
    }
    case "replace": {
      if (!edit.anchorText) return null;
      // Uniqueness was the proposal-time guarantee; the chapter has likely
      // shifted by apply time, so first match is the best we can do.
      const combined =
        (edit.prefix ?? "") + edit.anchorText + (edit.suffix ?? "");
      const idx = content.indexOf(combined);
      if (idx < 0) return null;
      const from = idx + (edit.prefix ?? "").length;
      return { from, to: from + edit.anchorText.length };
    }
  }
}

/**
 * Read a chapter's content overlaid with all `approved` edits for the same
 * run. Used by `read_chapter` when invoked from an editor agent so a later
 * editor in the same tier sees the earlier editor's staged work.
 */
export async function getChapterWithStagedEdits(
  runId: string,
  chapterId: string,
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
