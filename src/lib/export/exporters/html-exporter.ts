import { match } from "ts-pattern";
import type { DocNode, InlineSpan } from "../markdown-to-nodes";
import { markdownToNodes } from "../markdown-to-nodes";
import type { ExportContent, ExportOptions } from "../types";
import {
  type BlockquoteNode,
  type CodeNode,
  type Exporter,
  type HeadingNode,
  type HrNode,
  type ImageNode,
  type ListNode,
  type PageBreakNode,
  type ParagraphNode,
  visitNodes,
} from "../visitor";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function spansToHtml(spans: InlineSpan[]): string {
  return spans
    .map((span) =>
      match(span)
        .with({ type: "lineBreak" }, () => "<br/>")
        .with({ type: "text" }, (textSpan) => {
          let html = escapeHtml(textSpan.text);

          if (textSpan.styles.includes("strikethrough")) {
            html = `<s>${html}</s>`;
          }
          if (textSpan.styles.includes("code")) {
            html = `<code>${html}</code>`;
          }
          if (textSpan.styles.includes("italic")) {
            html = `<em>${html}</em>`;
          }
          if (textSpan.styles.includes("bold")) {
            html = `<strong>${html}</strong>`;
          }

          if (textSpan.ruby) {
            html = `<ruby>${html}<rt>${escapeHtml(textSpan.ruby)}</rt></ruby>`;
          }

          return html;
        })
        .exhaustive(),
    )
    .join("");
}

function buildStyleAttr(alignment?: string, indent?: number): string {
  const styles: string[] = [];
  if (alignment && alignment !== "left") {
    styles.push(`text-align: ${alignment}`);
  }
  if (indent && indent > 0) {
    styles.push(`margin-left: ${indent * 2}em`);
  }
  return styles.length > 0 ? ` style="${styles.join("; ")}"` : "";
}

export class HtmlExporter implements Exporter {
  private parts: string[] = [];

  visitHeading(node: HeadingNode): void {
    const tag = `h${node.level}`;
    const style = buildStyleAttr(node.alignment, node.indent);
    this.parts.push(`<${tag}${style}>${spansToHtml(node.spans)}</${tag}>`);
  }

  visitParagraph(node: ParagraphNode): void {
    const style = buildStyleAttr(node.alignment, node.indent);
    this.parts.push(`<p${style}>${spansToHtml(node.spans)}</p>`);
  }

  visitBlockquote(node: BlockquoteNode): void {
    const inner = new HtmlExporter();
    visitNodes(node.children, inner);
    this.parts.push(`<blockquote>\n${inner.toString()}\n</blockquote>`);
  }

  visitList(node: ListNode): void {
    const tag = node.ordered ? "ol" : "ul";
    const items = node.items
      .map((itemNodes) => {
        const inner = new HtmlExporter();
        visitNodes(itemNodes, inner);
        return `<li>${inner.toString()}</li>`;
      })
      .join("\n");
    this.parts.push(`<${tag}>\n${items}\n</${tag}>`);
  }

  visitCode(node: CodeNode): void {
    this.parts.push(`<pre><code>${escapeHtml(node.text)}</code></pre>`);
  }

  visitHr(_node: HrNode): void {
    this.parts.push("<hr>");
  }

  visitImage(node: ImageNode): void {
    const altAttr = node.alt ? ` alt="${escapeHtml(node.alt)}"` : "";
    this.parts.push(`<img src="${escapeHtml(node.src)}"${altAttr} />`);
  }

  visitPageBreak(_node: PageBreakNode): void {
    this.parts.push("<hr>");
  }

  addTitlePage(title: string): void {
    this.parts.push(`<h1>${escapeHtml(title)}</h1>`);
    this.parts.push("<hr>");
  }

  addChapterHeading(title: string): void {
    this.parts.push(`<h2>${escapeHtml(title)}</h2>`);
  }

  addPageBreak(): void {
    // HTML doesn't support page breaks; no-op for chapter separation
  }

  toString(): string {
    return this.parts.join("\n");
  }

  toBlob(): Blob {
    return new Blob([this.toString()], { type: "text/html" });
  }
}

/** Convert DocNodes to HTML string (backward compat). */
export function nodesToHtml(nodes: DocNode[]): string {
  const exporter = new HtmlExporter();
  visitNodes(nodes, exporter);
  return exporter.toString();
}

/**
 * Export full content to HTML string (backward compat).
 * Joins sections with double newlines to match original output format.
 */
export function exportHtml(
  content: ExportContent,
  options: ExportOptions,
): string {
  const sections: string[] = [];

  if (options.includeTitlePage && options.scope === "book") {
    sections.push(`<h1>${escapeHtml(content.projectTitle)}</h1>`);
    sections.push("<hr>");
  }

  for (const chapter of content.chapters) {
    if (chapter.isSeparator) {
      const style = chapter.pageBreakBefore
        ? ' style="page-break-before: always"'
        : "";
      sections.push(`<h1${style}>${escapeHtml(chapter.title)}</h1>`);
      continue;
    }
    if (options.includeChapterHeadings) {
      const level = Math.min(6, 2 + (chapter.level ?? 0));
      sections.push(`<h${level}>${escapeHtml(chapter.title)}</h${level}>`);
    }
    const nodes = markdownToNodes(chapter.content);
    sections.push(nodesToHtml(nodes));
  }

  return sections.join("\n\n");
}
