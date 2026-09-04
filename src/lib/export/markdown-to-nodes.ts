import { Lexer, type MarkedToken, type Token } from "marked";
import { match } from "ts-pattern";

type InlineStyle = "bold" | "italic" | "code" | "strikethrough";
export type TextAlignment = "left" | "center" | "right" | "justify";

export interface TextSpan {
  type: "text";
  text: string;
  styles: InlineStyle[];
  /** Ruby annotation text (for CJK reading guides) */
  ruby?: string;
}

interface LineBreakSpan {
  type: "lineBreak";
}

/**
 * Inline content within a paragraph or heading. `lineBreak` is a hard
 * line break (shift+enter in the editor; `\\\n` in markdown) — distinct
 * from a literal newline embedded in `text`, which carries no semantics.
 */
export type InlineSpan = TextSpan | LineBreakSpan;

export type DocNode =
  | {
      type: "heading";
      level: 1 | 2 | 3 | 4 | 5 | 6;
      spans: InlineSpan[];
      alignment?: TextAlignment;
      indent?: number;
    }
  | {
      type: "paragraph";
      spans: InlineSpan[];
      alignment?: TextAlignment;
      indent?: number;
    }
  | { type: "blockquote"; children: DocNode[] }
  | { type: "list"; ordered: boolean; items: DocNode[][] }
  | { type: "code"; text: string }
  | { type: "hr" }
  | { type: "image"; src: string; alt?: string }
  | { type: "pageBreak" };

function textSpan(text: string, styles: InlineStyle[]): TextSpan {
  return { type: "text", text, styles };
}

function parseInlineTokens(
  tokens: Token[] | undefined,
  parentStyles: InlineStyle[] = [],
): InlineSpan[] {
  if (!tokens) return [];
  const spans: InlineSpan[] = [];

  for (const token of tokens) {
    // marked's `Token` type adds an untyped `Tokens.Generic` escape hatch for
    // custom lexer extensions, which this file's plain Lexer never produces.
    // Matching against `MarkedToken` (no Generic) lets ts-pattern narrow `t`
    // to the concrete token shape in every branch below, with no re-casting.
    match(token as MarkedToken)
      .with({ type: "text" }, (t) => {
        if (t.tokens) {
          spans.push(...parseInlineTokens(t.tokens, parentStyles));
        } else {
          spans.push(textSpan(t.text, [...parentStyles]));
        }
      })
      .with({ type: "strong" }, (t) => {
        spans.push(...parseInlineTokens(t.tokens, [...parentStyles, "bold"]));
      })
      .with({ type: "em" }, (t) => {
        spans.push(...parseInlineTokens(t.tokens, [...parentStyles, "italic"]));
      })
      .with({ type: "del" }, (t) => {
        spans.push(
          ...parseInlineTokens(t.tokens, [...parentStyles, "strikethrough"]),
        );
      })
      .with({ type: "codespan" }, (t) => {
        spans.push(textSpan(t.text, [...parentStyles, "code"]));
      })
      .with({ type: "br" }, () => {
        spans.push({ type: "lineBreak" });
      })
      .with({ type: "escape" }, (t) => {
        spans.push(textSpan(t.text, [...parentStyles]));
      })
      .with({ type: "link" }, (t) => {
        spans.push(...parseInlineTokens(t.tokens, parentStyles));
      })
      .with({ type: "image" }, (t) => {
        spans.push(textSpan(t.text || t.title || "[image]", [...parentStyles]));
      })
      .with({ type: "html" }, (t) => {
        // Handle ruby text: <ruby>base<rt>annotation</rt></ruby>
        const rubyMatch = t.raw.match(
          /<ruby[^>]*>([^<]*)<rt[^>]*>([^<]*)<\/rt><\/ruby>/i,
        );
        if (rubyMatch) {
          spans.push({
            type: "text",
            text: rubyMatch[1],
            styles: [...parentStyles],
            ruby: rubyMatch[2],
          });
        } else {
          // For other inline HTML, extract text content
          const textContent = t.raw.replace(/<[^>]+>/g, "");
          if (textContent.trim()) {
            spans.push(textSpan(textContent, [...parentStyles]));
          }
        }
      })
      .otherwise(() => {
        if ("text" in token && typeof token.text === "string") {
          spans.push(textSpan(token.text, [...parentStyles]));
        }
      });
  }

  return spans;
}

function parseHtmlImage(raw: string): DocNode | null {
  const imgMatch = raw.match(
    /<img[^>]+src="([^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*\/?>/i,
  );
  if (!imgMatch) return null;
  return { type: "image", src: imgMatch[1], alt: imgMatch[2] || undefined };
}

function parseHtmlAlignmentAndIndent(raw: string): {
  alignment?: TextAlignment;
  indent?: number;
} {
  const alignMatch = raw.match(
    /style="[^"]*text-align:\s*(left|center|right|justify)[^"]*"/i,
  );
  const alignment = alignMatch?.[1] as TextAlignment | undefined;

  const indentAttrMatch = raw.match(/data-indent="(\d+)"/i);
  const marginMatch = raw.match(/margin-left:\s*(\d+)em/i);
  const indent = indentAttrMatch
    ? Number.parseInt(indentAttrMatch[1], 10)
    : marginMatch
      ? Math.round(Number.parseInt(marginMatch[1], 10) / 2)
      : undefined;

  return { alignment, indent };
}

function parseHtmlHeading(
  raw: string,
  alignment?: TextAlignment,
  indent?: number,
): DocNode | null {
  const headingMatch = raw.match(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/i);
  if (!headingMatch) return null;
  const level = Number.parseInt(headingMatch[1], 10) as 1 | 2 | 3 | 4 | 5 | 6;
  const content = headingMatch[2].replace(/<[^>]+>/g, "");
  return {
    type: "heading",
    level,
    spans: [textSpan(content, [])],
    alignment,
    indent,
  };
}

function parseHtmlParagraph(
  raw: string,
  alignment?: TextAlignment,
  indent?: number,
): DocNode | null {
  const pMatch = raw.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!pMatch) return null;
  const content = pMatch[1].replace(/<[^>]+>/g, "");
  return {
    type: "paragraph",
    spans: [textSpan(content, [])],
    alignment,
    indent,
  };
}

function walkTokens(tokens: Token[]): DocNode[] {
  const nodes: DocNode[] = [];

  for (const token of tokens) {
    // marked's `Token` type adds an untyped `Tokens.Generic` escape hatch for
    // custom lexer extensions, which this file's plain Lexer never produces.
    // Matching against `MarkedToken` (no Generic) lets ts-pattern narrow `t`
    // to the concrete token shape in every branch below, with no re-casting.
    match(token as MarkedToken)
      .with({ type: "heading" }, (t) => {
        nodes.push({
          type: "heading",
          level: t.depth as 1 | 2 | 3 | 4 | 5 | 6,
          spans: parseInlineTokens(t.tokens),
        });
      })
      .with({ type: "paragraph" }, (t) => {
        nodes.push({
          type: "paragraph",
          spans: parseInlineTokens(t.tokens),
        });
      })
      .with({ type: "blockquote" }, (t) => {
        nodes.push({
          type: "blockquote",
          children: walkTokens(t.tokens),
        });
      })
      .with({ type: "list" }, (t) => {
        nodes.push({
          type: "list",
          ordered: t.ordered,
          items: t.items.map((item) => walkTokens(item.tokens)),
        });
      })
      .with({ type: "code" }, (t) => {
        nodes.push({ type: "code", text: t.text });
      })
      .with({ type: "hr" }, () => {
        nodes.push({ type: "hr" });
      })
      .with({ type: "html" }, (t) => {
        const raw = t.raw;

        const image = parseHtmlImage(raw);
        if (image) {
          nodes.push(image);
          return;
        }

        // A scene-break marker (`<hr data-type="sceneBreak" …>`, serialized by
        // the SceneBreak node) or any bare `<hr>` arrives as an inline HTML
        // block. Without this, the tag-stripping fallback below reduces it to
        // an empty string and the break is silently dropped from the export.
        if (/^\s*<hr\b[^>]*>\s*$/i.test(raw)) {
          nodes.push({ type: "hr" });
          return;
        }

        const { alignment, indent } = parseHtmlAlignmentAndIndent(raw);

        const heading = parseHtmlHeading(raw, alignment, indent);
        if (heading) {
          nodes.push(heading);
          return;
        }

        const paragraph = parseHtmlParagraph(raw, alignment, indent);
        if (paragraph) {
          nodes.push(paragraph);
          return;
        }

        // Fallback: extract text content for other HTML
        const textContent = raw.replace(/<[^>]+>/g, "").trim();
        if (textContent) {
          nodes.push({
            type: "paragraph",
            spans: [textSpan(textContent, [])],
          });
        }
      })
      .with({ type: "space" }, () => {
        // Ignore space tokens
      })
      .otherwise(() => {
        if ("text" in token && typeof token.text === "string") {
          nodes.push({
            type: "paragraph",
            spans: [textSpan(token.text, [])],
          });
        }
      });
  }

  return nodes;
}

export function markdownToNodes(markdown: string): DocNode[] {
  const tokens = new Lexer().lex(markdown);
  return walkTokens(tokens);
}
