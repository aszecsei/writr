import type {
  Content,
  ContentText,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import { match } from "ts-pattern";
import type { InlineSpan, TextAlignment, TextSpan } from "../markdown-to-nodes";
import { loadPdfMake } from "../pdfmake";
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

/** Typed `[left, top, right, bottom]` margin tuple, pdfmake's 4-value form. */
function margin(
  left: number,
  top: number,
  right: number,
  bottom: number,
): [number, number, number, number] {
  return [left, top, right, bottom];
}

type PdfTextPart = {
  text: string;
  bold?: boolean;
  italics?: boolean;
  decoration?: "lineThrough";
  font?: string;
  fontSize?: number;
  color?: string;
};

function spanToPdfParts(s: TextSpan): PdfTextPart[] {
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

function inlineSpanToPdfParts(span: InlineSpan): PdfTextPart[] {
  return match(span)
    .with({ type: "lineBreak" }, () => [{ text: "\n" }])
    .with({ type: "text" }, (textSpan) => spanToPdfParts(textSpan))
    .exhaustive();
}

function spansToPdfText(spans: InlineSpan[]): ContentText {
  if (spans.length === 0) return { text: "" };
  const onlySpan = spans[0];
  if (spans.length === 1 && onlySpan.type === "text" && !onlySpan.ruby) {
    return {
      text: onlySpan.text,
      bold: onlySpan.styles.includes("bold") || undefined,
      italics: onlySpan.styles.includes("italic") || undefined,
      decoration: onlySpan.styles.includes("strikethrough")
        ? "lineThrough"
        : undefined,
      font: onlySpan.styles.includes("code") ? "Courier" : undefined,
    };
  }
  return {
    text: spans.flatMap((s) => inlineSpanToPdfParts(s)),
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
      margin: margin(leftMargin, 12, 0, 4),
    });
  }

  visitParagraph(node: ParagraphNode): void {
    const leftMargin = node.indent ? node.indent * 20 : 0;
    this.content.push({
      ...spansToPdfText(node.spans),
      alignment: mapAlignment(node.alignment),
      margin: margin(leftMargin, 0, 0, 8),
    });
  }

  visitBlockquote(node: BlockquoteNode): void {
    const inner = new PdfExporter();
    visitNodes(node.children, inner);
    this.content.push({
      margin: margin(20, 0, 0, 8),
      stack: inner.content,
      italics: true,
      color: "#555555",
    });
  }

  visitList(node: ListNode): void {
    const listItems: Content[] = node.items.map((itemNodes) => {
      const inner = new PdfExporter();
      visitNodes(itemNodes, inner);
      return inner.content.length === 1
        ? inner.content[0]
        : { stack: inner.content };
    });
    if (node.ordered) {
      this.content.push({
        ol: listItems,
        margin: margin(0, 0, 0, 8),
      });
    } else {
      this.content.push({
        ul: listItems,
        margin: margin(0, 0, 0, 8),
      });
    }
  }

  visitCode(node: CodeNode): void {
    this.content.push({
      text: node.text,
      font: "Courier",
      fontSize: 9,
      background: "#f5f5f5",
      margin: margin(0, 0, 0, 8),
    });
  }

  visitHr(_node: HrNode): void {
    this.content.push({
      text: HR_TEXT,
      alignment: "center",
      color: "#666666",
      fontSize: 12,
      margin: margin(0, 12, 0, 12),
    });
  }

  visitImage(node: ImageNode): void {
    this.content.push({
      text: imagePlaceholder(node.alt),
      italics: true,
      color: "#666666",
      alignment: "center",
      margin: margin(0, 8, 0, 8),
    });
  }

  visitPageBreak(_node: PageBreakNode): void {
    this.content.push({ text: "", pageBreak: "before" });
  }

  addTitlePage(title: string): void {
    this.content.push(
      { text: "", margin: margin(0, 200, 0, 0) },
      {
        text: title,
        fontSize: 28,
        bold: true,
        alignment: "center",
        margin: margin(0, 0, 0, 0),
      },
      { text: "", pageBreak: "after" },
    );
  }

  addChapterHeading(title: string): void {
    this.content.push({
      text: title,
      fontSize: 24,
      bold: true,
      margin: margin(0, 0, 0, 12),
    });
  }

  addPageBreak(): void {
    this.content.push({ text: "", pageBreak: "before" });
  }

  async toBlob(): Promise<Blob> {
    const pdfMake = await loadPdfMake();

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
