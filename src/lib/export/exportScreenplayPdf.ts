import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { match } from "ts-pattern";
import type { FountainElement } from "@/lib/fountain";
import { parseFountain } from "@/lib/fountain";
import { loadPdfMake } from "./pdfmake";
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
  return elements.map((el) =>
    match(el)
      .with(
        { type: "scene_heading" },
        (e): Content =>
          ({
            text: e.text.toUpperCase(),
            bold: true,
            margin: [0, 12, 0, 6],
          }) as Content,
      )
      .with(
        { type: "action" },
        (e): Content =>
          ({
            text: e.text,
            margin: [0, 6, 0, 0],
          }) as Content,
      )
      .with(
        { type: "character" },
        (e): Content =>
          ({
            text: e.text.toUpperCase(),
            margin: [CHARACTER_INDENT, 6, 0, 0],
          }) as Content,
      )
      .with(
        { type: "dialogue" },
        (e): Content =>
          ({
            text: e.text,
            margin: [DIALOGUE_LEFT, 0, DIALOGUE_RIGHT, 0],
          }) as Content,
      )
      .with({ type: "parenthetical" }, (e): Content => {
        const text = e.text.startsWith("(") ? e.text : `(${e.text})`;
        return {
          text,
          margin: [PAREN_LEFT, 0, PAREN_RIGHT, 0],
        } as Content;
      })
      .with(
        { type: "transition" },
        (e): Content =>
          ({
            text: e.text.toUpperCase(),
            alignment: "right",
            margin: [0, 6, 0, 0],
          }) as Content,
      )
      .with(
        { type: "centered" },
        (e): Content =>
          ({
            text: e.text,
            alignment: "center",
            margin: [0, 6, 0, 0],
          }) as Content,
      )
      .with(
        { type: "page_break" },
        (): Content => ({ text: "", pageBreak: "before" }) as Content,
      )
      .exhaustive(),
  );
}

export async function exportScreenplayPdf(
  content: ExportContent,
  options: ExportOptions,
): Promise<Blob> {
  const pdfMake = await loadPdfMake();

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

  const sequences = content.chapters.filter((c) => !c.isSeparator);
  for (let i = 0; i < sequences.length; i++) {
    const chapter = sequences[i];

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
