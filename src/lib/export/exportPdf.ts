import type {
  Content,
  ContentText,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import type { DocNode, TextSpan } from "./markdown-to-nodes";
import { markdownToNodes } from "./markdown-to-nodes";
import type { ExportContent, ExportOptions } from "./types";

const HEADING_SIZES: Record<number, number> = {
  1: 24,
  2: 20,
  3: 16,
  4: 14,
  5: 12,
  6: 11,
};

function spansToPdfText(spans: TextSpan[]): ContentText {
  if (spans.length === 0) return { text: "" };
  if (spans.length === 1) {
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
    text: spans.map((s) => ({
      text: s.text,
      bold: s.styles.includes("bold") || undefined,
      italics: s.styles.includes("italic") || undefined,
      decoration: s.styles.includes("strikethrough")
        ? ("lineThrough" as const)
        : undefined,
      font: s.styles.includes("code") ? "Courier" : undefined,
    })),
  };
}

function nodesToPdfContent(nodes: DocNode[]): Content[] {
  const result: Content[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case "heading": {
        const textContent = spansToPdfText(node.spans);
        result.push({
          ...textContent,
          fontSize: HEADING_SIZES[node.level] ?? 12,
          bold: true,
          margin: [0, 12, 0, 4] as [number, number, number, number],
        });
        break;
      }
      case "paragraph":
        result.push({
          ...spansToPdfText(node.spans),
          margin: [0, 0, 0, 8] as [number, number, number, number],
        });
        break;
      case "blockquote": {
        const inner = nodesToPdfContent(node.children);
        result.push({
          margin: [20, 0, 0, 8] as [number, number, number, number],
          stack: inner,
          italics: true,
          color: "#555555",
        } as Content);
        break;
      }
      case "list": {
        const items: Content[] = node.items.map((itemNodes) => {
          const itemContent = nodesToPdfContent(itemNodes);
          return itemContent.length === 1
            ? itemContent[0]
            : ({ stack: itemContent } as Content);
        });
        if (node.ordered) {
          result.push({
            ol: items,
            margin: [0, 0, 0, 8] as [number, number, number, number],
          } as Content);
        } else {
          result.push({
            ul: items,
            margin: [0, 0, 0, 8] as [number, number, number, number],
          } as Content);
        }
        break;
      }
      case "code":
        result.push({
          text: node.text,
          font: "Courier",
          fontSize: 9,
          background: "#f5f5f5",
          margin: [0, 0, 0, 8] as [number, number, number, number],
        } as Content);
        break;
      case "hr":
        result.push({
          text: "*\u2003\u2003*\u2003\u2003*",
          alignment: "center",
          color: "#666666",
          fontSize: 12,
          margin: [0, 12, 0, 12] as [number, number, number, number],
        } as Content);
        break;
      case "pageBreak":
        result.push({ text: "", pageBreak: "before" } as Content);
        break;
    }
  }

  return result;
}

export async function exportPdf(
  content: ExportContent,
  options: ExportOptions,
): Promise<Blob> {
  const pdfMakeModule = await import("pdfmake/build/pdfmake");
  const pdfFontsModule = await import("pdfmake/build/vfs_fonts");

  const pdfMake = pdfMakeModule.default ?? pdfMakeModule;
  const vfs = pdfFontsModule.default ?? pdfFontsModule;
  pdfMake.addVirtualFileSystem(vfs);

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
