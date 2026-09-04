import { match } from "ts-pattern";
import { forEachExportItem } from "./for-each-export-item";
import type { DocNode } from "./markdown-to-nodes";
import { markdownToNodes } from "./markdown-to-nodes";
import type { ExportContent, ExportLoopOptions } from "./types";

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
  options: ExportLoopOptions,
): void {
  forEachExportItem(content, options, {
    titlePage: (title) => exporter.addTitlePage(title),
    pageBreak: () => exporter.addPageBreak(),
    chapterHeading: (item) => exporter.addChapterHeading(item.title),
    chapter: (item) => visitNodes(markdownToNodes(item.content), exporter),
  });
}

/** Calls buildExport then toBlob(). */
export async function runExport(
  exporter: Exporter,
  content: ExportContent,
  options: ExportLoopOptions,
): Promise<Blob> {
  buildExport(exporter, content, options);
  return exporter.toBlob();
}
