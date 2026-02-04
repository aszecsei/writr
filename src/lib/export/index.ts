import { match } from "ts-pattern";
import { triggerDownload } from "./download";
import { exportDocx } from "./exportDocx";
import { exportMarkdown } from "./exportMarkdown";
import { exportPdf } from "./exportPdf";
import { gatherContent } from "./gather";
import type { ExportOptions } from "./types";

export {
  copyChapterAo3HtmlToClipboard,
  copyChapterMarkdownToClipboard,
} from "./clipboard";

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

  const blob = await match(options.format)
    .with("markdown", () => exportMarkdown(content, options))
    .with("docx", () => exportDocx(content, options))
    .with("pdf", () => exportPdf(content, options))
    .exhaustive();

  const baseName =
    options.scope === "chapter" && content.chapters.length === 1
      ? sanitizeFilename(content.chapters[0].title)
      : sanitizeFilename(content.projectTitle);

  const filename = baseName + FORMAT_EXTENSIONS[options.format];
  triggerDownload(blob, filename);
}

export type { ExportFormat, ExportOptions, ExportScope } from "./types";
