import type { Chapter, ProjectMode } from "@/db/schemas";
import { hashText } from "@/lib/hash";
import type { HoleDelimiters } from "@/lib/holes";

/**
 * Fingerprint of everything a repeated-passages run read: which chapters,
 * in what order, with what text, parsed how. A differing key means the
 * results on screen no longer reflect the manuscript. Keyed on a content
 * hash rather than `updatedAt`, because leaving a chapter re-saves it (and
 * bumps `updatedAt`) even when nothing changed.
 */
export function makeRepeatRunKey(
  chapters: readonly Pick<Chapter, "id" | "content">[],
  mode: ProjectMode,
  delimiters: HoleDelimiters,
): string {
  const revisions = chapters
    .map((c) => `${c.id}@${hashText(c.content)}`)
    .join(",");
  return `${mode}|${delimiters.open}|${delimiters.close}|${revisions}`;
}
