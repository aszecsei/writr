import type {
  Content,
  ContentText,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import { match } from "ts-pattern";
import type { DocNode, TextAlignment, TextSpan } from "./markdown-to-nodes";
import { markdownToNodes } from "./markdown-to-nodes";
import { HR_TEXT, imagePlaceholder } from "./shared";
import type { ExportContent, ExportOptions } from "./types";

const HEADING_SIZES: Record<number, number> = {
  1: 24,
  2: 20,
  3: 16,
  4: 14,
  5: 12,
  6: 11,
};

type PdfAlignment = "left" | "center" | "right" | "justify";

function mapAlignment(alignment?: TextAlignment): PdfAlignment | undefined {
  return alignment as PdfAlignment | undefined;
}

function spanToPdfParts(s: TextSpan): Array<{
  text: string;
  bold?: boolean;
  italics?: boolean;
  decoration?: "lineThrough";
  font?: string;
  fontSize?: number;
  color?: string;
}> {
  const base = {
    bold: s.styles.includes("bold") || undefined,
    italics: s.styles.includes("italic") || undefined,
    decoration: s.styles.includes("strikethrough")
      ? ("lineThrough" as const)
      : undefined,
    font: s.styles.includes("code") ? "Courier" : undefined,
  };

  // For ruby text, render as "base(annotation)"
  if (s.ruby) {
    return [
      { text: s.text, ...base },
      { text: `(${s.ruby})`, fontSize: 8, color: "#666666" },
    ];
  }

  return [{ text: s.text, ...base }];
}

function spansToPdfText(spans: TextSpan[]): ContentText {
  if (spans.length === 0) return { text: "" };
  if (spans.length === 1 && !spans[0].ruby) {
    const s = spans[0];
    return {
      text: s.text,
      bold: s.styles.includes("bold") || undefined,
      italics: s.styles.includes("italic") || undefined,
      decoration: s.styles.includes("strikethrough")
        ? "lineThrough"
        : undefined,
      font: s.styles.includes("code") ? "Courier" : undefined,
    };
  }
  return {
    text: spans.flatMap((s) => spanToPdfParts(s)),
  };
}

function handlePdfBlockquote(children: DocNode[]): Content {
  const inner = nodesToPdfContent(children);
  return {
    margin: [20, 0, 0, 8] as [number, number, number, number],
    stack: inner,
    italics: true,
    color: "#555555",
  } as Content;
}

function handlePdfList(ordered: boolean, items: DocNode[][]): Content {
  const listItems: Content[] = items.map((itemNodes) => {
    const itemContent = nodesToPdfContent(itemNodes);
    return itemContent.length === 1
      ? itemContent[0]
      : ({ stack: itemContent } as Content);
  });
  if (ordered) {
    return {
      ol: listItems,
      margin: [0, 0, 0, 8] as [number, number, number, number],
    } as Content;
  }
  return {
    ul: listItems,
    margin: [0, 0, 0, 8] as [number, number, number, number],
  } as Content;
}

function nodesToPdfContent(nodes: DocNode[]): Content[] {
  const result: Content[] = [];

  for (const node of nodes) {
    match(node)
      .with({ type: "heading" }, ({ level, spans, alignment, indent }) => {
        const textContent = spansToPdfText(spans);
        const leftMargin = indent ? indent * 20 : 0;
        result.push({
          ...textContent,
          fontSize: HEADING_SIZES[level] ?? 12,
          bold: true,
          alignment: mapAlignment(alignment),
          margin: [leftMargin, 12, 0, 4] as [number, number, number, number],
        });
      })
      .with({ type: "paragraph" }, ({ spans, alignment, indent }) => {
        const leftMargin = indent ? indent * 20 : 0;
        result.push({
          ...spansToPdfText(spans),
          alignment: mapAlignment(alignment),
          margin: [leftMargin, 0, 0, 8] as [number, number, number, number],
        });
      })
      .with({ type: "blockquote" }, ({ children }) => {
        result.push(handlePdfBlockquote(children));
      })
      .with({ type: "list" }, ({ ordered, items }) => {
        result.push(handlePdfList(ordered, items));
      })
      .with({ type: "code" }, ({ text }) => {
        result.push({
          text,
          font: "Courier",
          fontSize: 9,
          background: "#f5f5f5",
          margin: [0, 0, 0, 8] as [number, number, number, number],
        } as Content);
      })
      .with({ type: "hr" }, () => {
        result.push({
          text: HR_TEXT,
          alignment: "center",
          color: "#666666",
          fontSize: 12,
          margin: [0, 12, 0, 12] as [number, number, number, number],
        } as Content);
      })
      .with({ type: "image" }, ({ alt }) => {
        // For images, add a placeholder text since embedding requires fetching
        result.push({
          text: imagePlaceholder(alt),
          italics: true,
          color: "#666666",
          alignment: "center",
          margin: [0, 8, 0, 8] as [number, number, number, number],
        } as Content);
      })
      .with({ type: "pageBreak" }, () => {
        result.push({ text: "", pageBreak: "before" } as Content);
      })
      .exhaustive();
  }

  return result;
}

export async function exportPdf(
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

  if (options.includeTitlePage && options.scope === "book") {
    allContent.push(
      { text: "", margin: [0, 200, 0, 0] } as Content,
      {
        text: content.projectTitle,
        fontSize: 28,
        bold: true,
        alignment: "center",
        margin: [0, 0, 0, 0],
      } as Content,
      { text: "", pageBreak: "after" } as Content,
    );
  }

  for (let i = 0; i < content.chapters.length; i++) {
    const chapter = content.chapters[i];

    if (
      i > 0 &&
      options.pageBreaksBetweenChapters &&
      options.scope === "book"
    ) {
      allContent.push({ text: "", pageBreak: "before" } as Content);
    }

    if (options.includeChapterHeadings) {
      allContent.push({
        text: chapter.title,
        fontSize: 24,
        bold: true,
        margin: [0, 0, 0, 12],
      } as Content);
    }

    const nodes = markdownToNodes(chapter.content);
    allContent.push(...nodesToPdfContent(nodes));
  }

  const docDefinition: TDocumentDefinitions = {
    content: allContent,
    defaultStyle: {
      fontSize: 12,
      font: "Roboto",
    },
  };

  return pdfMake.createPdf(docDefinition).getBlob();
}
