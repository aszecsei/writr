import type { ExportContent, ExportOptions } from "./types";

/**
 * Export screenplay content as a Fountain (.fountain) text file.
 *
 * Concatenates chapter (sequence) content with === page breaks between them.
 * Optionally prepends a Fountain title page.
 */
export function exportFountain(
  content: ExportContent,
  options: ExportOptions,
): Blob {
  const parts: string[] = [];

  // Fountain title page (only for full screenplay export)
  if (options.includeTitlePage && options.scope === "book") {
    parts.push(`Title: ${content.projectTitle}`);
    parts.push(""); // Blank line ends title page
  }

  for (let i = 0; i < content.chapters.length; i++) {
    if (i > 0) {
      // Page break between sequences
      parts.push("");
      parts.push("===");
      parts.push("");
    }
    parts.push(content.chapters[i].content);
  }

  const text = parts.join("\n");
  return new Blob([text], { type: "text/plain;charset=utf-8" });
}
