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

export interface ExportContent {
  projectTitle: string;
  chapters: { title: string; content: string }[];
}
