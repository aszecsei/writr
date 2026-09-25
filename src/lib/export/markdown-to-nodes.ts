import { Lexer, type MarkedToken, type Token } from "marked";
import { match } from "ts-pattern";

type InlineStyle = "bold" | "italic" | "code" | "strikethrough" | "underline";
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

const TAG_STYLES: Record<string, InlineStyle> = {
  strong: "bold",
  b: "bold",
  em: "italic",
  i: "italic",
  s: "strikethrough",
  del: "strikethrough",
  strike: "strikethrough",
  code: "code",
  u: "underline",
  ins: "underline",
};

function stylesFor(
  openTags: string[],
  parentStyles: InlineStyle[] = [],
): InlineStyle[] {
  return [
    ...new Set([
      ...parentStyles,
      ...openTags.flatMap((tag) =>
        Object.hasOwn(TAG_STYLES, tag) ? TAG_STYLES[tag] : [],
      ),
    ]),
  ];
}

/** Pushes an opening tag or removes the matching closing tag's opener. */
function trackTag(openTags: string[], tag: string, closing: boolean): void {
  if (!closing) {
    openTags.push(tag);
    return;
  }
  const index = openTags.lastIndexOf(tag);
  if (index !== -1) openTags.splice(index, 1);
}

function parseInlineTokens(
  tokens: Token[] | undefined,
  parentStyles: InlineStyle[] = [],
): InlineSpan[] {
  if (!tokens) return [];
  const spans: InlineSpan[] = [];
  // Inline HTML such as `<u>` arrives as separate open and close tokens.
  const openTags: string[] = [];

  for (const token of tokens) {
    const styles = stylesFor(openTags, parentStyles);
    // marked's `Token` type adds an untyped `Tokens.Generic` escape hatch for
    // custom lexer extensions, which this file's plain Lexer never produces.
    // Matching against `MarkedToken` (no Generic) lets ts-pattern narrow `t`
    // to the concrete token shape in every branch below, with no re-casting.
    match(token as MarkedToken)
      .with({ type: "text" }, (t) => {
        if (t.tokens) {
          spans.push(...parseInlineTokens(t.tokens, styles));
        } else {
          spans.push(textSpan(t.text, [...styles]));
        }
      })
      .with({ type: "strong" }, (t) => {
        spans.push(...parseInlineTokens(t.tokens, [...styles, "bold"]));
      })
      .with({ type: "em" }, (t) => {
        spans.push(...parseInlineTokens(t.tokens, [...styles, "italic"]));
      })
      .with({ type: "del" }, (t) => {
        spans.push(
          ...parseInlineTokens(t.tokens, [...styles, "strikethrough"]),
        );
      })
      .with({ type: "codespan" }, (t) => {
        spans.push(textSpan(t.text, [...styles, "code"]));
      })
      .with({ type: "br" }, () => {
        spans.push({ type: "lineBreak" });
      })
      .with({ type: "escape" }, (t) => {
        spans.push(textSpan(t.text, [...styles]));
      })
      .with({ type: "link" }, (t) => {
        spans.push(...parseInlineTokens(t.tokens, styles));
      })
      .with({ type: "image" }, (t) => {
        spans.push(textSpan(t.text || t.title || "[image]", [...styles]));
      })
      .with({ type: "html" }, (t) => {
        const tagMatch = t.raw.match(/^<(\/?)([a-z][a-z0-9]*)\b[^>]*>$/i);
        const tag = tagMatch?.[2].toLowerCase();
        if (tagMatch && tag && Object.hasOwn(TAG_STYLES, tag)) {
          trackTag(openTags, tag, tagMatch[1] === "/");
          return;
        }
        // Handle ruby text: <ruby>base<rt>annotation</rt></ruby>
        const rubyMatch = t.raw.match(
          /<ruby[^>]*>([^<]*)<rt[^>]*>([^<]*)<\/rt><\/ruby>/i,
        );
        if (rubyMatch) {
          spans.push({
            type: "text",
            text: rubyMatch[1],
            styles: [...styles],
            ruby: rubyMatch[2],
          });
        } else {
          // For other inline HTML, extract text content
          const textContent = t.raw.replace(/<[^>]+>/g, "");
          if (textContent.trim()) {
            spans.push(textSpan(textContent, [...styles]));
          }
        }
      })
      .otherwise(() => {
        if ("text" in token && typeof token.text === "string") {
          spans.push(textSpan(token.text, [...styles]));
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

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi,
    (entity, dec, hex, name) => {
      if (dec) return String.fromCodePoint(Number.parseInt(dec, 10));
      if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
      return NAMED_ENTITIES[name.toLowerCase()] ?? entity;
    },
  );
}

/**
 * Parses the inner HTML of a block written by `MarkdownBlockAttrs`
 * (`getHTMLFromFragment` output). Deliberately not routed through marked:
 * the HTML text is not markdown-escaped, so `2*3*4` would turn italic.
 */
function parseHtmlInline(html: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const openTags: string[] = [];
  let ruby: { base: string; annotation: string } | null = null;
  let inRt = false;
  const activeStyles = () => stylesFor(openTags);

  const tokenPattern = /<(\/?)([a-z][a-z0-9]*)\b([^>]*)>|([^<]+)/gi;
  for (const [, closing, rawTag, attrs, text] of html.matchAll(tokenPattern)) {
    if (text !== undefined) {
      if (inRt) continue;
      const decoded = decodeEntities(text);
      if (ruby) ruby.base += decoded;
      else spans.push(textSpan(decoded, activeStyles()));
      continue;
    }

    const tag = rawTag.toLowerCase();
    if (tag === "br") {
      spans.push({ type: "lineBreak" });
    } else if (tag === "rt") {
      inRt = !closing;
    } else if (tag === "ruby") {
      if (!closing) {
        const annotation = attrs.match(/data-annotation="([^"]*)"/i)?.[1];
        ruby = { base: "", annotation: decodeEntities(annotation ?? "") };
      } else if (ruby) {
        spans.push({
          ...textSpan(ruby.base, activeStyles()),
          ...(ruby.annotation ? { ruby: ruby.annotation } : {}),
        });
        ruby = null;
      }
    } else if (closing || !attrs.trimEnd().endsWith("/")) {
      trackTag(openTags, tag, Boolean(closing));
    }
  }

  // The serializer wraps a top-level block's content in newlines.
  const first = spans[0];
  if (first?.type === "text") first.text = first.text.trimStart();
  const last = spans.at(-1);
  if (last?.type === "text") last.text = last.text.trimEnd();
  return spans.filter((span) => span.type !== "text" || span.text !== "");
}

function parseHtmlHeading(
  raw: string,
  alignment?: TextAlignment,
  indent?: number,
): DocNode | null {
  const headingMatch = raw.match(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/i);
  if (!headingMatch) return null;
  const level = Number.parseInt(headingMatch[1], 10) as 1 | 2 | 3 | 4 | 5 | 6;
  return {
    type: "heading",
    level,
    spans: parseHtmlInline(headingMatch[2]),
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
  return {
    type: "paragraph",
    spans: parseHtmlInline(pMatch[1]),
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
