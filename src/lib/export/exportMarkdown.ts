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
    if (chapter.isSeparator) {
      parts.push(`# ${chapter.title}\n`);
      parts.push("");
      continue;
    }
    if (options.includeChapterHeadings) {
      const level = Math.min(6, 2 + (chapter.level ?? 0));
      parts.push(`${"#".repeat(level)} ${chapter.title}\n`);
    }
    parts.push(chapter.content);
    parts.push(""); // blank line between chapters
  }

  return new Blob([parts.join("\n")], { type: "text/markdown;charset=utf-8" });
}
