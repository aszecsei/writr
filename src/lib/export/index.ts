import { match } from "ts-pattern";
import { triggerDownload } from "@/lib/download";
import { sanitizeFilename } from "@/lib/filename";
import { DocxExporter } from "./exporters/docx-exporter";
import { PdfExporter } from "./exporters/pdf-exporter";
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
export { type ExportHoleScan, scanExportHoles } from "./holes-scan";

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
      runExport(new DocxExporter(), content, options),
    )
    .with({ format: "pdf" }, () =>
      runExport(new PdfExporter(), content, options),
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
