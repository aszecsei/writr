import { forEachExportItem } from "./for-each-export-item";
import type { ExportContent, ExportOptions } from "./types";

export function exportMarkdown(
  content: ExportContent,
  options: ExportOptions,
): Blob {
  const parts: string[] = [];

  forEachExportItem(content, options, {
    titlePage: (title) => parts.push(`# ${title}\n\n---\n`),
    chapterHeading: (item) => {
      if (item.isSeparator) {
        parts.push(`# ${item.title}\n`);
        parts.push("");
        return;
      }
      const level = Math.min(6, 2 + (item.level ?? 0));
      parts.push(`${"#".repeat(level)} ${item.title}\n`);
    },
    chapter: (item) => {
      parts.push(item.content);
      parts.push(""); // blank line between chapters
    },
  });

  return new Blob([parts.join("\n")], { type: "text/markdown;charset=utf-8" });
}
