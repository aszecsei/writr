import { getChapter } from "@/db/operations/chapters";
import { listApprovedEditsForChapter } from "@/db/operations/proposedEdits";
import type { ProposedEdit } from "@/db/schemas";

/**
 * Apply a list of proposed edits to a chapter content string. Edits are
 * applied in REVERSE offset order so earlier offsets remain valid as later
 * portions of the string change. Falls back to anchorText search when the
 * recorded `(fromOffset, toOffset)` no longer matches.
 *
 * Returns:
 *   - `content`: the patched string
 *   - `applied`: edit ids that were successfully applied
 *   - `skipped`: edit ids that couldn't be located
 *
 * Used both by `getChapterWithStagedEdits` (read-only overlay for editor
 * agents) and by `applyTier` (final commit). Pure — no DB writes.
 */
export function applyEditsToContent(
  content: string,
  edits: ProposedEdit[],
): { content: string; applied: string[]; skipped: string[] } {
  const applied: string[] = [];
  const skipped: string[] = [];

  // Order in document position so we can apply right-to-left without races.
  const ordered = [...edits].sort((a, b) => {
    const ao = a.fromOffset ?? 0;
    const bo = b.fromOffset ?? 0;
    return bo - ao;
  });

  let working = content;

  for (const edit of ordered) {
    const range = locateEdit(working, edit);
    if (!range) {
      skipped.push(edit.id);
      continue;
    }
    working =
      working.slice(0, range.from) + edit.newContent + working.slice(range.to);
    applied.push(edit.id);
  }

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
    case "replace_range": {
      if (
        typeof edit.fromOffset === "number" &&
        typeof edit.toOffset === "number" &&
        edit.fromOffset >= 0 &&
        edit.toOffset <= content.length &&
        edit.fromOffset <= edit.toOffset
      ) {
        if (!edit.anchorText) {
          return { from: edit.fromOffset, to: edit.toOffset };
        }
        const slice = content.slice(edit.fromOffset, edit.toOffset);
        if (slice === edit.anchorText) {
          return { from: edit.fromOffset, to: edit.toOffset };
        }
      }
      if (edit.anchorText) {
        const idx = content.indexOf(edit.anchorText);
        if (idx >= 0) {
          return { from: idx, to: idx + edit.anchorText.length };
        }
      }
      return null;
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
