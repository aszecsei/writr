import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { FountainElement } from "@/lib/fountain";
import { parseFountain } from "@/lib/fountain";
import type { ExportContent, ExportOptions } from "./types";

// Standard screenplay margins (US Letter)
// Left: 1.5" (108pt), Right: 1" (72pt), Top/Bottom: 1" (72pt)
const MARGIN_LEFT = 108;
const MARGIN_RIGHT = 72;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 72;

// Element indentation relative to page content area
// Content area width: 612 - 108 - 72 = 432pt
const CHARACTER_INDENT = 144; // ~2" from left margin
const DIALOGUE_LEFT = 72; // ~1" indent from left margin
const DIALOGUE_RIGHT = 108; // ~1.5" from right
const PAREN_LEFT = 108; // ~1.5" from left
const PAREN_RIGHT = 144; // ~2" from right

function elementsToContent(elements: FountainElement[]): Content[] {
  const result: Content[] = [];

  for (const el of elements) {
    switch (el.type) {
      case "scene_heading":
        result.push({
          text: el.text.toUpperCase(),
          bold: true,
          margin: [0, 12, 0, 6],
        } as Content);
        break;

      case "action":
        result.push({
          text: el.text,
          margin: [0, 6, 0, 0],
        } as Content);
        break;

      case "character":
        result.push({
          text: el.text.toUpperCase(),
          margin: [CHARACTER_INDENT, 6, 0, 0],
        } as Content);
        break;

      case "dialogue":
        result.push({
          text: el.text,
          margin: [DIALOGUE_LEFT, 0, DIALOGUE_RIGHT, 0],
        } as Content);
        break;

      case "parenthetical": {
        const text = el.text.startsWith("(") ? el.text : `(${el.text})`;
        result.push({
          text,
          margin: [PAREN_LEFT, 0, PAREN_RIGHT, 0],
        } as Content);
        break;
      }

      case "transition":
        result.push({
          text: el.text.toUpperCase(),
          alignment: "right",
          margin: [0, 6, 0, 0],
        } as Content);
        break;

      case "centered":
        result.push({
          text: el.text,
          alignment: "center",
          margin: [0, 6, 0, 0],
        } as Content);
        break;

      case "page_break":
        result.push({ text: "", pageBreak: "before" } as Content);
        break;
    }
  }

  return result;
}

export async function exportScreenplayPdf(
  content: ExportContent,
  options: ExportOptions,
): Promise<Blob> {
  const pdfMakeModule = await import("pdfmake/build/pdfmake");
  const pdfFontsModule = await import("pdfmake/build/vfs_fonts");
  const courierFontModule = await import(
    "pdfmake/build/standard-fonts/Courier"
  );

  const pdfMake = pdfMakeModule.default ?? pdfMakeModule;
  const vfs = pdfFontsModule.default ?? pdfFontsModule;
  pdfMake.addVirtualFileSystem(vfs);

  const courierFont = courierFontModule.default ?? courierFontModule;
  pdfMake.addFontContainer(courierFont);

  const allContent: Content[] = [];

  // Title page
  if (options.includeTitlePage && options.scope === "book") {
    allContent.push(
      { text: "", margin: [0, 200, 0, 0] } as Content,
      {
        text: content.projectTitle,
        fontSize: 24,
        bold: true,
        alignment: "center",
        margin: [0, 0, 0, 0],
      } as Content,
      { text: "", pageBreak: "after" } as Content,
    );
  }

  for (let i = 0; i < content.chapters.length; i++) {
    const chapter = content.chapters[i];

    if (i > 0) {
      allContent.push({ text: "", pageBreak: "before" } as Content);
    }

    // Parse Fountain content and convert to PDF
    const elements = parseFountain(chapter.content);
    allContent.push(...elementsToContent(elements));
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: "LETTER",
    pageMargins: [MARGIN_LEFT, MARGIN_TOP, MARGIN_RIGHT, MARGIN_BOTTOM],
    content: allContent,
    defaultStyle: {
      fontSize: 12,
      font: "Courier",
      lineHeight: 1,
    },
    header: (currentPage, _pageCount) => {
      if (currentPage === 1) return "";
      return {
        text: `${currentPage}.`,
        alignment: "right",
        margin: [0, 36, MARGIN_RIGHT, 0],
        fontSize: 12,
        font: "Courier",
      };
    },
  };

  return pdfMake.createPdf(docDefinition).getBlob();
}
