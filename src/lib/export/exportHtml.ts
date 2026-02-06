import { match } from "ts-pattern";
import type { DocNode, TextSpan } from "./markdown-to-nodes";
import { markdownToNodes } from "./markdown-to-nodes";
import type { ExportContent, ExportOptions } from "./types";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function spansToHtml(spans: TextSpan[]): string {
  return spans
    .map((span) => {
      let html = escapeHtml(span.text);

      // Apply styles in order: strikethrough, code, italic, bold
      // (innermost to outermost for proper nesting)
      if (span.styles.includes("strikethrough")) {
        html = `<s>${html}</s>`;
      }
      if (span.styles.includes("code")) {
        html = `<code>${html}</code>`;
      }
      if (span.styles.includes("italic")) {
        html = `<em>${html}</em>`;
      }
      if (span.styles.includes("bold")) {
        html = `<strong>${html}</strong>`;
      }

      // Handle ruby text
      if (span.ruby) {
        html = `<ruby>${html}<rt>${escapeHtml(span.ruby)}</rt></ruby>`;
      }

      return html;
    })
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

function nodeToHtml(node: DocNode): string {
  return match(node)
    .with({ type: "heading" }, (n) => {
      const tag = `h${n.level}`;
      const style = buildStyleAttr(n.alignment, n.indent);
      return `<${tag}${style}>${spansToHtml(n.spans)}</${tag}>`;
    })
    .with({ type: "paragraph" }, (n) => {
      const style = buildStyleAttr(n.alignment, n.indent);
      return `<p${style}>${spansToHtml(n.spans)}</p>`;
    })
    .with({ type: "blockquote" }, (n) => {
      const inner = n.children.map(nodeToHtml).join("\n");
      return `<blockquote>\n${inner}\n</blockquote>`;
    })
    .with({ type: "list" }, (n) => {
      const tag = n.ordered ? "ol" : "ul";
      const items = n.items
        .map((itemNodes) => {
          const inner = itemNodes.map(nodeToHtml).join("");
          return `<li>${inner}</li>`;
        })
        .join("\n");
      return `<${tag}>\n${items}\n</${tag}>`;
    })
    .with({ type: "code" }, (n) => {
      return `<pre><code>${escapeHtml(n.text)}</code></pre>`;
    })
    .with({ type: "hr" }, () => {
      return "<hr>";
    })
    .with({ type: "image" }, (n) => {
      const altAttr = n.alt ? ` alt="${escapeHtml(n.alt)}"` : "";
      return `<img src="${escapeHtml(n.src)}"${altAttr} />`;
    })
    .with({ type: "pageBreak" }, () => {
      // AO3 doesn't support page breaks, render as hr
      return "<hr>";
    })
    .exhaustive();
}

export function nodesToHtml(nodes: DocNode[]): string {
  return nodes.map(nodeToHtml).join("\n");
}

export function exportHtml(
  content: ExportContent,
  options: ExportOptions,
): string {
  const parts: string[] = [];

  if (options.includeTitlePage && options.scope === "book") {
    parts.push(`<h1>${escapeHtml(content.projectTitle)}</h1>`);
    parts.push("<hr>");
  }

  for (const chapter of content.chapters) {
    if (options.includeChapterHeadings) {
      parts.push(`<h2>${escapeHtml(chapter.title)}</h2>`);
    }
    const nodes = markdownToNodes(chapter.content);
    parts.push(nodesToHtml(nodes));
  }

  return parts.join("\n\n");
}
