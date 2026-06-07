import { getAppSettings } from "@/db/operations";
import { countHoles } from "@/lib/holes";
import { gatherContent } from "./gather";
import type { ExportOptions } from "./types";

export interface ExportHoleScan {
  /** Total holes across every chapter in scope. */
  total: number;
  /** Per-chapter breakdown, only for chapters that contain holes. */
  chapters: { title: string; count: number }[];
}

/**
 * Scan the exact material an export would emit for holes (bracketed placeholder
 * sections — see `src/lib/holes.ts`). Reuses `gatherContent`, so the scope
 * (single chapter vs. whole book) matches `performExport` exactly.
 */
export async function scanExportHoles(
  options: ExportOptions,
): Promise<ExportHoleScan> {
  const [content, settings] = await Promise.all([
    gatherContent(options),
    getAppSettings(),
  ]);
  const { holeDelimiters } = settings;

  const chapters: { title: string; count: number }[] = [];
  let total = 0;
  for (const chapter of content.chapters) {
    if (chapter.isSeparator) continue;
    const count = countHoles(chapter.content, holeDelimiters);
    if (count > 0) {
      chapters.push({ title: chapter.title, count });
      total += count;
    }
  }

  return { total, chapters };
}
