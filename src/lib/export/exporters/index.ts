import { match } from "ts-pattern";
import type { ExportOptions } from "../types";
import type { Exporter } from "../visitor";
import { DocxExporter } from "./docx-exporter";
import { PdfExporter } from "./pdf-exporter";

export { DocxExporter } from "./docx-exporter";
export { exportHtml, HtmlExporter, nodesToHtml } from "./html-exporter";
export { PdfExporter } from "./pdf-exporter";

export function createExporter(options: ExportOptions): Exporter {
  return match(options.format)
    .with("docx", (): Exporter => new DocxExporter())
    .with("pdf", (): Exporter => new PdfExporter())
    .otherwise((format) => {
      throw new Error(`No visitor-based exporter for format: ${format}`);
    });
}
