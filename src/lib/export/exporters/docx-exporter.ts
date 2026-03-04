import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  type ISectionOptions,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";
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

const HEADING_MAP: Record<
  number,
  (typeof HeadingLevel)[keyof typeof HeadingLevel]
> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

const ALIGNMENT_MAP: Record<
  TextAlignment,
  (typeof AlignmentType)[keyof typeof AlignmentType]
> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

const FONT = "Times New Roman";
const FONT_SIZE = 24; // 12pt in half-points
const DOUBLE_SPACING = 480; // double-spaced in 240ths of a line
const FIRST_LINE_INDENT = 720; // 0.5" in twips
const MARGIN = 1440; // 1" in twips

function spanToRunOptions(span: TextSpan) {
  return {
    bold: span.styles.includes("bold"),
    italics: span.styles.includes("italic"),
    strike: span.styles.includes("strikethrough"),
    font: span.styles.includes("code") ? "Courier New" : FONT,
    size: FONT_SIZE,
  };
}

function spansToRuns(spans: TextSpan[]): TextRun[] {
  const runs: TextRun[] = [];
  for (const span of spans) {
    runs.push(new TextRun({ text: span.text, ...spanToRunOptions(span) }));
    if (span.ruby) {
      runs.push(
        new TextRun({
          text: ` (${span.ruby})`,
          size: 16,
          color: "666666",
        }),
      );
    }
  }
  return runs;
}

export class DocxExporter implements Exporter {
  private paragraphs: Paragraph[] = [];

  visitHeading(node: HeadingNode): void {
    this.paragraphs.push(
      new Paragraph({
        heading: HEADING_MAP[node.level],
        children: spansToRuns(node.spans),
        alignment: node.alignment ? ALIGNMENT_MAP[node.alignment] : undefined,
        indent: node.indent ? { left: node.indent * 720 } : undefined,
      }),
    );
  }

  visitParagraph(node: ParagraphNode): void {
    this.paragraphs.push(
      new Paragraph({
        children: spansToRuns(node.spans),
        spacing: { line: DOUBLE_SPACING },
        alignment: node.alignment ? ALIGNMENT_MAP[node.alignment] : undefined,
        indent: node.indent
          ? { left: node.indent * 720 }
          : { firstLine: FIRST_LINE_INDENT },
      }),
    );
  }

  visitBlockquote(node: BlockquoteNode): void {
    for (const child of node.children) {
      if (child.type === "paragraph") {
        this.paragraphs.push(
          new Paragraph({
            children: spansToRuns(child.spans),
            spacing: { line: DOUBLE_SPACING },
            indent: { left: 720 },
            border: {
              left: {
                style: "single" as const,
                size: 6,
                space: 10,
                color: "999999",
              },
            },
          }),
        );
      } else {
        visitNodes([child], this);
      }
    }
  }

  visitList(node: ListNode): void {
    for (const [i, itemNodes] of node.items.entries()) {
      for (const [j, itemNode] of itemNodes.entries()) {
        if (itemNode.type === "paragraph") {
          const bullet = node.ordered ? `${i + 1}. ` : "\u2022 ";
          const runs = spansToRuns(itemNode.spans);
          if (j === 0) {
            runs.unshift(
              new TextRun({ text: bullet, font: FONT, size: FONT_SIZE }),
            );
          }
          this.paragraphs.push(
            new Paragraph({
              children: runs,
              spacing: { line: DOUBLE_SPACING },
              indent: { left: 720 },
            }),
          );
        } else {
          visitNodes([itemNode], this);
        }
      }
    }
  }

  visitCode(node: CodeNode): void {
    for (const line of node.text.split("\n")) {
      this.paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: line, font: "Courier New", size: FONT_SIZE }),
          ],
        }),
      );
    }
  }

  visitHr(_node: HrNode): void {
    this.paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: HR_TEXT,
            font: FONT,
            size: FONT_SIZE,
            color: "666666",
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200, line: DOUBLE_SPACING },
      }),
    );
  }

  visitImage(node: ImageNode): void {
    this.paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: imagePlaceholder(node.alt),
            italics: true,
            color: "666666",
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 100 },
      }),
    );
  }

  visitPageBreak(_node: PageBreakNode): void {
    this.paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
  }

  addTitlePage(title: string): void {
    this.paragraphs.push(
      new Paragraph({ spacing: { before: 3000 } }),
      new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: title, bold: true, font: FONT, size: FONT_SIZE }),
        ],
      }),
      new Paragraph({ children: [new PageBreak()] }),
    );
  }

  addChapterHeading(title: string): void {
    this.paragraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 2400 },
        children: [
          new TextRun({ text: title, font: FONT, size: FONT_SIZE, bold: true }),
        ],
      }),
    );
  }

  addPageBreak(): void {
    this.paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
  }

  async toBlob(): Promise<Blob> {
    const section: ISectionOptions = {
      children: this.paragraphs,
      properties: {
        page: {
          size: { width: 12240, height: 15840 }, // US Letter (8.5" × 11")
          margin: {
            top: MARGIN,
            right: MARGIN,
            bottom: MARGIN,
            left: MARGIN,
            header: 720,
            footer: 720,
          },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  children: [PageNumber.CURRENT],
                  font: FONT,
                  size: FONT_SIZE,
                }),
              ],
            }),
          ],
        }),
      },
    };
    const doc = new Document({
      sections: [section],
      styles: {
        default: {
          document: {
            run: { font: FONT, size: FONT_SIZE },
            paragraph: { spacing: { line: DOUBLE_SPACING } },
          },
        },
      },
    });
    return Packer.toBlob(doc);
  }
}
