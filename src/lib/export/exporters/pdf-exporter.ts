import type {
  Content,
  ContentText,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import type { TextAlignment, TextSpan } from "../markdown-to-nodes";
import { HR_TEXT, imagePlaceholder } from "../shared";
import type {
  BlockquoteNode,
  CodeNode,
  Exporter,
  HeadingNode,
  HrNode,
  ImageNode,
  ListNode,
  PageBreakNode,
  ParagraphNode,
} from "../visitor";
import { visitNodes } from "../visitor";

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

export class PdfExporter implements Exporter {
  private content: Content[] = [];

  visitHeading(node: HeadingNode): void {
    const textContent = spansToPdfText(node.spans);
    const leftMargin = node.indent ? node.indent * 20 : 0;
    this.content.push({
      ...textContent,
      fontSize: HEADING_SIZES[node.level] ?? 12,
      bold: true,
      alignment: mapAlignment(node.alignment),
      margin: [leftMargin, 12, 0, 4] as [number, number, number, number],
    });
  }

  visitParagraph(node: ParagraphNode): void {
    const leftMargin = node.indent ? node.indent * 20 : 0;
    this.content.push({
      ...spansToPdfText(node.spans),
      alignment: mapAlignment(node.alignment),
      margin: [leftMargin, 0, 0, 8] as [number, number, number, number],
    });
  }

  visitBlockquote(node: BlockquoteNode): void {
    const inner = new PdfExporter();
    visitNodes(node.children, inner);
    this.content.push({
      margin: [20, 0, 0, 8] as [number, number, number, number],
      stack: inner.content,
      italics: true,
      color: "#555555",
    } as Content);
  }

  visitList(node: ListNode): void {
    const listItems: Content[] = node.items.map((itemNodes) => {
      const inner = new PdfExporter();
      visitNodes(itemNodes, inner);
      return inner.content.length === 1
        ? inner.content[0]
        : ({ stack: inner.content } as Content);
    });
    if (node.ordered) {
      this.content.push({
        ol: listItems,
        margin: [0, 0, 0, 8] as [number, number, number, number],
      } as Content);
    } else {
      this.content.push({
        ul: listItems,
        margin: [0, 0, 0, 8] as [number, number, number, number],
      } as Content);
    }
  }

  visitCode(node: CodeNode): void {
    this.content.push({
      text: node.text,
      font: "Courier",
      fontSize: 9,
      background: "#f5f5f5",
      margin: [0, 0, 0, 8] as [number, number, number, number],
    } as Content);
  }

  visitHr(_node: HrNode): void {
    this.content.push({
      text: HR_TEXT,
      alignment: "center",
      color: "#666666",
      fontSize: 12,
      margin: [0, 12, 0, 12] as [number, number, number, number],
    } as Content);
  }

  visitImage(node: ImageNode): void {
    this.content.push({
      text: imagePlaceholder(node.alt),
      italics: true,
      color: "#666666",
      alignment: "center",
      margin: [0, 8, 0, 8] as [number, number, number, number],
    } as Content);
  }

  visitPageBreak(_node: PageBreakNode): void {
    this.content.push({ text: "", pageBreak: "before" } as Content);
  }

  addTitlePage(title: string): void {
    this.content.push(
      { text: "", margin: [0, 200, 0, 0] } as Content,
      {
        text: title,
        fontSize: 28,
        bold: true,
        alignment: "center",
        margin: [0, 0, 0, 0],
      } as Content,
      { text: "", pageBreak: "after" } as Content,
    );
  }

  addChapterHeading(title: string): void {
    this.content.push({
      text: title,
      fontSize: 24,
      bold: true,
      margin: [0, 0, 0, 12],
    } as Content);
  }

  addPageBreak(): void {
    this.content.push({ text: "", pageBreak: "before" } as Content);
  }

  async toBlob(): Promise<Blob> {
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

    const docDefinition: TDocumentDefinitions = {
      content: this.content,
      defaultStyle: {
        fontSize: 12,
        font: "Roboto",
      },
    };

    return pdfMake.createPdf(docDefinition).getBlob();
  }
}
