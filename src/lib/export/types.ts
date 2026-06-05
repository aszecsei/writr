import type { ChapterId, ProjectId, ProjectMode } from "@/db/schemas";

export type ExportFormat = "markdown" | "docx" | "pdf" | "fountain";
export type ExportScope = "chapter" | "book";

export interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  projectId: ProjectId;
  chapterId?: ChapterId;
  includeTitlePage: boolean;
  includeChapterHeadings: boolean;
  pageBreaksBetweenChapters: boolean;
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
