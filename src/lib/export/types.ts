import type { ChapterId, ProjectId, ProjectMode } from "@/db/schemas";

export type ExportFormat = "markdown" | "docx" | "pdf" | "fountain";
export type ExportScope = "chapter" | "book";

/** The fields the title-page/chapter-heading/page-break iteration order needs. */
export interface ExportLoopOptions {
  scope: ExportScope;
  includeTitlePage: boolean;
  includeChapterHeadings: boolean;
  pageBreaksBetweenChapters: boolean;
}

export interface ExportOptions extends ExportLoopOptions {
  format: ExportFormat;
  projectId: ProjectId;
  chapterId?: ChapterId;
  projectMode?: ProjectMode;
}

export interface ExportItem {
  title: string;
  content: string;
  /** Nesting depth in the binder (0 = top level). */
  level?: number;
  /** A separator marker (a structural heading) rather than a prose document. */
  isSeparator?: boolean;
  /** For separators: force a page break before the heading in paginated formats. */
  pageBreakBefore?: boolean;
}

export interface ExportContent {
  projectTitle: string;
  chapters: ExportItem[];
}
