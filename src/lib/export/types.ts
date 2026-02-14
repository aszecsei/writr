import type { ProjectMode } from "@/db/schemas";

export type ExportFormat = "markdown" | "docx" | "pdf" | "fountain";
export type ExportScope = "chapter" | "book";

export interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  projectId: string;
  chapterId?: string;
  includeTitlePage: boolean;
  includeChapterHeadings: boolean;
  pageBreaksBetweenChapters: boolean;
  projectMode?: ProjectMode;
}

export interface ExportContent {
  projectTitle: string;
  chapters: { title: string; content: string }[];
}
