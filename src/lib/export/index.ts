import { match } from "ts-pattern";
import { triggerDownload } from "./download";
import { createExporter } from "./exporters";
import { exportFountain } from "./exportFountain";
import { exportMarkdown } from "./exportMarkdown";
import { exportScreenplayPdf } from "./exportScreenplayPdf";
import { gatherContent } from "./gather";
import type { ExportOptions } from "./types";
import { runExport } from "./visitor";

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
  fountain: ".fountain",
};

export async function performExport(options: ExportOptions): Promise<void> {
  const content = await gatherContent(options);

  const blob = await match(options)
    .with({ format: "markdown" }, () => exportMarkdown(content, options))
    .with({ format: "fountain" }, () => exportFountain(content, options))
    .with({ format: "pdf", projectMode: "screenplay" }, () =>
      exportScreenplayPdf(content, options),
    )
    .with({ format: "docx" }, () =>
      runExport(createExporter(options), content, options),
    )
    .with({ format: "pdf" }, () =>
      runExport(createExporter(options), content, options),
    )
    .exhaustive();

  const baseName =
    options.scope === "chapter" && content.chapters.length === 1
      ? sanitizeFilename(content.chapters[0].title)
      : sanitizeFilename(content.projectTitle);

  const filename = baseName + FORMAT_EXTENSIONS[options.format];
  triggerDownload(blob, filename);
}

export type { ExportFormat, ExportOptions, ExportScope } from "./types";
