import {
  AlignmentType,
  Document,
  HeadingLevel,
  type ISectionOptions,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} from "docx";
import type { DocNode, TextSpan } from "./markdown-to-nodes";
import { markdownToNodes } from "./markdown-to-nodes";
import type { ExportContent, ExportOptions } from "./types";

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

function spansToRuns(spans: TextSpan[]): TextRun[] {
  return spans.map(
    (span) =>
      new TextRun({
        text: span.text,
        bold: span.styles.includes("bold"),
        italics: span.styles.includes("italic"),
        strike: span.styles.includes("strikethrough"),
        font: span.styles.includes("code") ? "Courier New" : undefined,
      }),
  );
}

function nodesToParagraphs(nodes: DocNode[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case "heading":
        paragraphs.push(
          new Paragraph({
            heading: HEADING_MAP[node.level],
            children: spansToRuns(node.spans),
          }),
        );
        break;
      case "paragraph":
        paragraphs.push(
          new Paragraph({
            children: spansToRuns(node.spans),
            spacing: { after: 200 },
          }),
        );
        break;
      case "blockquote":
        for (const child of node.children) {
          if (child.type === "paragraph") {
            paragraphs.push(
              new Paragraph({
                children: spansToRuns(child.spans),
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
            paragraphs.push(...nodesToParagraphs([child]));
          }
        }
        break;
      case "list":
        for (const [i, itemNodes] of node.items.entries()) {
          for (const [j, itemNode] of itemNodes.entries()) {
            if (itemNode.type === "paragraph") {
              const bullet = node.ordered ? `${i + 1}. ` : "\u2022 ";
              const runs = spansToRuns(itemNode.spans);
              if (j === 0) {
                runs.unshift(new TextRun({ text: bullet }));
              }
              paragraphs.push(
                new Paragraph({
                  children: runs,
                  indent: { left: 720 },
                }),
              );
            } else {
              paragraphs.push(...nodesToParagraphs([itemNode]));
            }
          }
        }
        break;
      case "code":
        for (const line of node.text.split("\n")) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: line, font: "Courier New", size: 20 }),
              ],
            }),
          );
        }
        break;
      case "hr":
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: "───────────────────" })],
            alignment: AlignmentType.CENTER,
          }),
        );
        break;
      case "pageBreak":
        paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
        break;
    }
  }

  return paragraphs;
}

export async function exportDocx(
  content: ExportContent,
  options: ExportOptions,
): Promise<Blob> {
  const allParagraphs: Paragraph[] = [];

  if (options.includeTitlePage && options.scope === "book") {
    allParagraphs.push(
      new Paragraph({ spacing: { before: 3000 } }),
      new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: content.projectTitle, bold: true })],
      }),
      new Paragraph({ children: [new PageBreak()] }),
    );
  }

  for (let i = 0; i < content.chapters.length; i++) {
    const chapter = content.chapters[i];

    if (
      i > 0 &&
      options.pageBreaksBetweenChapters &&
      options.scope === "book"
    ) {
      allParagraphs.push(new Paragraph({ children: [new PageBreak()] }));
    }

    if (options.includeChapterHeadings) {
      allParagraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: chapter.title })],
        }),
      );
    }

    const nodes = markdownToNodes(chapter.content);
    allParagraphs.push(...nodesToParagraphs(nodes));
  }

  const section: ISectionOptions = {
    children: allParagraphs,
  };

  const doc = new Document({
    sections: [section],
  });

  return Packer.toBlob(doc);
}
