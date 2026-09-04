import { type DocNode, markdownToNodes } from "@/lib/export/markdown-to-nodes";
import { type HoleDelimiters, stripHoles } from "@/lib/holes";
import { splitParagraphs } from "@/lib/text/split-paragraphs";

function spanText(node: Extract<DocNode, { type: "paragraph" }>): string {
  return node.spans
    .map((span) => (span.type === "text" ? span.text : " "))
    .join("")
    .trim();
}

function collectParagraphs(nodes: DocNode[], out: string[]): void {
  for (const node of nodes) {
    switch (node.type) {
      case "paragraph": {
        const text = spanText(node);
        if (text) out.push(text);
        break;
      }
      case "blockquote":
        collectParagraphs(node.children, out);
        break;
      case "list":
        for (const item of node.items) collectParagraphs(item, out);
        break;
      // Headings are titles, not prose; code/hr/images carry no prose at all.
      case "heading":
      case "code":
      case "hr":
      case "image":
      case "pageBreak":
        break;
    }
  }
}

/**
 * Reduce a chapter's markdown to the plain prose paragraphs the analysis
 * should run over: inline formatting unwrapped; headings, code blocks,
 * scene-break rules and images dropped; holes removed.
 *
 * Holes are stripped AFTER lexing — the default `[...]` delimiters collide
 * with markdown link/image syntax, so stripping first would corrupt
 * `[text](url)` into `(url)`.
 */
export function markdownToPlainParagraphs(
  markdown: string,
  delimiters: HoleDelimiters,
): string[] {
  // Inline images surface their alt text as an ordinary text span in
  // markdownToNodes output; alt text isn't prose, so drop the whole image.
  const withoutImages = markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  const paragraphs: string[] = [];
  collectParagraphs(markdownToNodes(withoutImages), paragraphs);
  return paragraphs
    .map((paragraph) => stripHoles(paragraph, delimiters).trim())
    .filter(Boolean);
}

/**
 * Screenplay (Fountain-ish) content is not markdown, so it bypasses the
 * lexer: strip holes, split on blank lines, drop structural-only lines
 * (transitions, page breaks, centered markers).
 */
export function screenplayToPlainParagraphs(
  content: string,
  delimiters: HoleDelimiters,
): string[] {
  return splitParagraphs(stripHoles(content, delimiters))
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.replace(/^>\s*|\s*<$/g, "").trim())
        .filter((line) => line && line !== "===")
        .join(" "),
    )
    .filter(Boolean);
}
