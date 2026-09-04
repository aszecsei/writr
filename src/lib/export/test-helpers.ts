import type { ProjectId } from "@/db/schemas";
import type { ExportOptions } from "./types";

export function opts(overrides: Partial<ExportOptions> = {}): ExportOptions {
  return {
    format: "markdown",
    scope: "book",
    projectId: "test" as ProjectId,
    includeTitlePage: false,
    includeChapterHeadings: false,
    pageBreaksBetweenChapters: false,
    ...overrides,
  };
}
