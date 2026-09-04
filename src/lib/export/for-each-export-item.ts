import type { ExportContent, ExportItem, ExportLoopOptions } from "./types";

export interface ExportItemHooks {
  titlePage?(title: string): void;
  pageBreak?(): void;
  chapterHeading?(item: ExportItem): void;
  chapter?(item: ExportItem): void;
}

/**
 * Shared title-page / chapter-heading / separator / page-break iteration
 * order for the prose export formats (docx, pdf, html, markdown). Screenplay
 * formats (fountain, screenplay pdf) don't fit this shape — they drop
 * separators entirely and page-break between every sequence unconditionally,
 * rather than gating on {@link ExportLoopOptions.pageBreaksBetweenChapters} —
 * so they iterate `content.chapters` themselves.
 */
export function forEachExportItem(
  content: ExportContent,
  options: ExportLoopOptions,
  hooks: ExportItemHooks,
): void {
  if (options.includeTitlePage && options.scope === "book") {
    hooks.titlePage?.(content.projectTitle);
  }

  for (let i = 0; i < content.chapters.length; i++) {
    const item = content.chapters[i];

    // A separator is a structural heading (e.g. "Part Two"); always render its
    // label and honor its page break, regardless of includeChapterHeadings.
    if (item.isSeparator) {
      if (item.pageBreakBefore && options.scope === "book") {
        hooks.pageBreak?.();
      }
      hooks.chapterHeading?.(item);
      continue;
    }

    if (
      i > 0 &&
      options.pageBreaksBetweenChapters &&
      options.scope === "book"
    ) {
      hooks.pageBreak?.();
    }

    if (options.includeChapterHeadings) {
      hooks.chapterHeading?.(item);
    }

    hooks.chapter?.(item);
  }
}
