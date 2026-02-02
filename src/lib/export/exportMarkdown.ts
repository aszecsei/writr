import type { ExportContent, ExportOptions } from "./types";

export function exportMarkdown(
  content: ExportContent,
  options: ExportOptions,
): Blob {
  const parts: string[] = [];

  if (options.includeTitlePage && options.scope === "book") {
    parts.push(`# ${content.projectTitle}\n\n---\n`);
  }

  for (const chapter of content.chapters) {
    if (options.includeChapterHeadings) {
      parts.push(`## ${chapter.title}\n`);
    }
    parts.push(chapter.content);
    parts.push(""); // blank line between chapters
  }

  return new Blob([parts.join("\n")], { type: "text/markdown;charset=utf-8" });
}
