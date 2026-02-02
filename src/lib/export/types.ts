export type ExportFormat = "markdown" | "docx" | "pdf";
export type ExportScope = "chapter" | "book";

export interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  projectId: string;
  chapterId?: string;
  includeTitlePage: boolean;
  includeChapterHeadings: boolean;
  pageBreaksBetweenChapters: boolean;
}

export interface ExportContent {
  projectTitle: string;
  chapters: { title: string; content: string }[];
}
