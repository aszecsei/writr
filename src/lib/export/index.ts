import { triggerDownload } from "./download";
import { exportDocx } from "./exportDocx";
import { exportMarkdown } from "./exportMarkdown";
import { exportPdf } from "./exportPdf";
import { gatherContent } from "./gather";
import type { ExportOptions } from "./types";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, "").trim() || "export";
}

const FORMAT_EXTENSIONS: Record<ExportOptions["format"], string> = {
  markdown: ".md",
  docx: ".docx",
  pdf: ".pdf",
};

export async function performExport(options: ExportOptions): Promise<void> {
  const content = await gatherContent(options);

  let blob: Blob;
  switch (options.format) {
    case "markdown":
      blob = exportMarkdown(content, options);
      break;
    case "docx":
      blob = await exportDocx(content, options);
      break;
    case "pdf":
      blob = await exportPdf(content, options);
      break;
  }

  const baseName =
    options.scope === "chapter" && content.chapters.length === 1
      ? sanitizeFilename(content.chapters[0].title)
      : sanitizeFilename(content.projectTitle);

  const filename = baseName + FORMAT_EXTENSIONS[options.format];
  triggerDownload(blob, filename);
}

export type { ExportFormat, ExportOptions, ExportScope } from "./types";
