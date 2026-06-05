import { match } from "ts-pattern";
import type { DocNode } from "./markdown-to-nodes";
import { markdownToNodes } from "./markdown-to-nodes";
import type { ExportContent, ExportOptions } from "./types";

// Named node types extracted from the DocNode union
export type HeadingNode = Extract<DocNode, { type: "heading" }>;
export type ParagraphNode = Extract<DocNode, { type: "paragraph" }>;
export type BlockquoteNode = Extract<DocNode, { type: "blockquote" }>;
export type ListNode = Extract<DocNode, { type: "list" }>;
export type CodeNode = Extract<DocNode, { type: "code" }>;
export type HrNode = Extract<DocNode, { type: "hr" }>;
export type ImageNode = Extract<DocNode, { type: "image" }>;
export type PageBreakNode = Extract<DocNode, { type: "pageBreak" }>;

/** Visitor interface — one method per DocNode variant. */
export interface DocNodeVisitor {
  visitHeading(node: HeadingNode): void;
  visitParagraph(node: ParagraphNode): void;
  visitBlockquote(node: BlockquoteNode): void;
  visitList(node: ListNode): void;
  visitCode(node: CodeNode): void;
  visitHr(node: HrNode): void;
  visitImage(node: ImageNode): void;
  visitPageBreak(node: PageBreakNode): void;
}

/** Full exporter = document lifecycle + visitor + finalization. */
export interface Exporter extends DocNodeVisitor {
  addTitlePage(title: string): void;
  addChapterHeading(title: string): void;
  addPageBreak(): void;
  toBlob(): Blob | Promise<Blob>;
}

/** Exhaustive dispatch — `.exhaustive()` is a compile-time check. */
export function visitNode(node: DocNode, visitor: DocNodeVisitor): void {
  match(node)
    .with({ type: "heading" }, (n) => visitor.visitHeading(n))
    .with({ type: "paragraph" }, (n) => visitor.visitParagraph(n))
    .with({ type: "blockquote" }, (n) => visitor.visitBlockquote(n))
    .with({ type: "list" }, (n) => visitor.visitList(n))
    .with({ type: "code" }, (n) => visitor.visitCode(n))
    .with({ type: "hr" }, (n) => visitor.visitHr(n))
    .with({ type: "image" }, (n) => visitor.visitImage(n))
    .with({ type: "pageBreak" }, (n) => visitor.visitPageBreak(n))
    .exhaustive();
}

export function visitNodes(nodes: DocNode[], visitor: DocNodeVisitor): void {
  for (const node of nodes) {
    visitNode(node, visitor);
  }
}

/**
 * Orchestrates title page, chapter iteration with page breaks/headings,
 * and markdownToNodes + visitNodes per chapter. Does NOT finalize.
 */
export function buildExport(
  exporter: Exporter,
  content: ExportContent,
  options: ExportOptions,
): void {
  if (options.includeTitlePage && options.scope === "book") {
    exporter.addTitlePage(content.projectTitle);
  }

  for (let i = 0; i < content.chapters.length; i++) {
    const chapter = content.chapters[i];

    // A separator is a structural heading (e.g. "Part Two"); always render its
    // label and honor its page break, regardless of includeChapterHeadings.
    if (chapter.isSeparator) {
      if (chapter.pageBreakBefore && options.scope === "book") {
        exporter.addPageBreak();
      }
      exporter.addChapterHeading(chapter.title);
      continue;
    }

    if (
      i > 0 &&
      options.pageBreaksBetweenChapters &&
      options.scope === "book"
    ) {
      exporter.addPageBreak();
    }

    if (options.includeChapterHeadings) {
      exporter.addChapterHeading(chapter.title);
    }

    const nodes = markdownToNodes(chapter.content);
    visitNodes(nodes, exporter);
  }
}

/** Calls buildExport then toBlob(). */
export async function runExport(
  exporter: Exporter,
  content: ExportContent,
  options: ExportOptions,
): Promise<Blob> {
  buildExport(exporter, content, options);
  return exporter.toBlob();
}
