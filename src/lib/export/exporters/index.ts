import type { ExportOptions } from "../types";
import type { Exporter } from "../visitor";
import { DocxExporter } from "./docx-exporter";
import { PdfExporter } from "./pdf-exporter";

export { DocxExporter } from "./docx-exporter";
export { exportHtml, HtmlExporter, nodesToHtml } from "./html-exporter";
export { PdfExporter } from "./pdf-exporter";

export function createExporter(options: ExportOptions): Exporter {
  switch (options.format) {
    case "docx":
      return new DocxExporter();
    case "pdf":
      return new PdfExporter();
    default:
      throw new Error(
        `No visitor-based exporter for format: ${options.format}`,
      );
  }
}
