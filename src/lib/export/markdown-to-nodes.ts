import { Lexer, type Token, type Tokens } from "marked";
import { match } from "ts-pattern";

export type InlineStyle = "bold" | "italic" | "code" | "strikethrough";
export type TextAlignment = "left" | "center" | "right" | "justify";

export interface TextSpan {
  text: string;
  styles: InlineStyle[];
  /** Ruby annotation text (for CJK reading guides) */
  ruby?: string;
}

export type DocNode =
  | {
      type: "heading";
      level: 1 | 2 | 3 | 4 | 5 | 6;
      spans: TextSpan[];
      alignment?: TextAlignment;
      indent?: number;
    }
  | {
      type: "paragraph";
      spans: TextSpan[];
      alignment?: TextAlignment;
      indent?: number;
    }
  | { type: "blockquote"; children: DocNode[] }
  | { type: "list"; ordered: boolean; items: DocNode[][] }
  | { type: "code"; text: string }
  | { type: "hr" }
  | { type: "image"; src: string; alt?: string }
  | { type: "pageBreak" };

function parseInlineTokens(
  tokens: Token[] | undefined,
  parentStyles: InlineStyle[] = [],
): TextSpan[] {
  if (!tokens) return [];
  const spans: TextSpan[] = [];

  for (const token of tokens) {
    match(token as Token)
      .with({ type: "text" }, (t) => {
        const textToken = t as Tokens.Text;
        if (textToken.tokens) {
          spans.push(...parseInlineTokens(textToken.tokens, parentStyles));
        } else {
          spans.push({ text: textToken.text, styles: [...parentStyles] });
        }
      })
      .with({ type: "strong" }, (t) => {
        const strongToken = t as Tokens.Strong;
        spans.push(
          ...parseInlineTokens(strongToken.tokens, [...parentStyles, "bold"]),
        );
      })
      .with({ type: "em" }, (t) => {
        const emToken = t as Tokens.Em;
        spans.push(
          ...parseInlineTokens(emToken.tokens, [...parentStyles, "italic"]),
        );
      })
      .with({ type: "del" }, (t) => {
        const delToken = t as Tokens.Del;
        spans.push(
          ...parseInlineTokens(delToken.tokens, [
            ...parentStyles,
            "strikethrough",
          ]),
        );
      })
      .with({ type: "codespan" }, (t) => {
        const codeToken = t as Tokens.Codespan;
        spans.push({ text: codeToken.text, styles: [...parentStyles, "code"] });
      })
      .with({ type: "br" }, () => {
        spans.push({ text: "\n", styles: [] });
      })
      .with({ type: "escape" }, (t) => {
        const escapeToken = t as Tokens.Escape;
        spans.push({ text: escapeToken.text, styles: [...parentStyles] });
      })
      .with({ type: "link" }, (t) => {
        const linkToken = t as Tokens.Link;
        spans.push(...parseInlineTokens(linkToken.tokens, parentStyles));
      })
      .with({ type: "image" }, (t) => {
        const imageToken = t as Tokens.Image;
        spans.push({
          text: imageToken.text || imageToken.title || "[image]",
          styles: [...parentStyles],
        });
      })
      .with({ type: "html" }, (t) => {
        const htmlToken = t as Tokens.HTML;
        // Handle ruby text: <ruby>base<rt>annotation</rt></ruby>
        const rubyMatch = htmlToken.raw.match(
          /<ruby[^>]*>([^<]*)<rt[^>]*>([^<]*)<\/rt><\/ruby>/i,
        );
        if (rubyMatch) {
          spans.push({
            text: rubyMatch[1],
            styles: [...parentStyles],
            ruby: rubyMatch[2],
          });
        } else {
          // For other inline HTML, extract text content
          const textContent = htmlToken.raw.replace(/<[^>]+>/g, "");
          if (textContent.trim()) {
            spans.push({ text: textContent, styles: [...parentStyles] });
          }
        }
      })
      .otherwise(() => {
        if ("text" in token && typeof token.text === "string") {
          spans.push({ text: token.text, styles: [...parentStyles] });
        }
      });
  }

  return spans;
}

function walkTokens(tokens: Token[]): DocNode[] {
  const nodes: DocNode[] = [];

  for (const token of tokens) {
    match(token as Token)
      .with({ type: "heading" }, (t) => {
        const headingToken = t as Tokens.Heading;
        nodes.push({
          type: "heading",
          level: headingToken.depth as 1 | 2 | 3 | 4 | 5 | 6,
          spans: parseInlineTokens(headingToken.tokens),
        });
      })
      .with({ type: "paragraph" }, (t) => {
        const paragraphToken = t as Tokens.Paragraph;
        nodes.push({
          type: "paragraph",
          spans: parseInlineTokens(paragraphToken.tokens),
        });
      })
      .with({ type: "blockquote" }, (t) => {
        const blockquoteToken = t as Tokens.Blockquote;
        nodes.push({
          type: "blockquote",
          children: walkTokens(blockquoteToken.tokens),
        });
      })
      .with({ type: "list" }, (t) => {
        const listToken = t as Tokens.List;
        nodes.push({
          type: "list",
          ordered: listToken.ordered,
          items: listToken.items.map((item) => walkTokens(item.tokens)),
        });
      })
      .with({ type: "code" }, (t) => {
        const codeToken = t as Tokens.Code;
        nodes.push({ type: "code", text: codeToken.text });
      })
      .with({ type: "hr" }, () => {
        nodes.push({ type: "hr" });
      })
      .with({ type: "html" }, (t) => {
        const htmlToken = t as Tokens.HTML;
        const raw = htmlToken.raw;

        // Handle image tags: <img src="..." alt="...">
        const imgMatch = raw.match(
          /<img[^>]+src="([^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*\/?>/i,
        );
        if (imgMatch) {
          nodes.push({
            type: "image",
            src: imgMatch[1],
            alt: imgMatch[2] || undefined,
          });
          return;
        }

        // Handle paragraphs/headings with alignment: style="text-align: center"
        const alignMatch = raw.match(
          /style="[^"]*text-align:\s*(left|center|right|justify)[^"]*"/i,
        );
        const alignment = alignMatch?.[1] as TextAlignment | undefined;

        // Handle indent: data-indent="N" or margin-left
        const indentAttrMatch = raw.match(/data-indent="(\d+)"/i);
        const marginMatch = raw.match(/margin-left:\s*(\d+)em/i);
        const indent = indentAttrMatch
          ? Number.parseInt(indentAttrMatch[1], 10)
          : marginMatch
            ? Math.round(Number.parseInt(marginMatch[1], 10) / 2)
            : undefined;

        // Handle heading tags with alignment/indent
        const headingMatch = raw.match(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/i);
        if (headingMatch) {
          const level = Number.parseInt(headingMatch[1], 10) as
            | 1
            | 2
            | 3
            | 4
            | 5
            | 6;
          const content = headingMatch[2].replace(/<[^>]+>/g, "");
          nodes.push({
            type: "heading",
            level,
            spans: [{ text: content, styles: [] }],
            alignment,
            indent,
          });
          return;
        }

        // Handle paragraph tags with alignment/indent
        const pMatch = raw.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
        if (pMatch) {
          const content = pMatch[1].replace(/<[^>]+>/g, "");
          nodes.push({
            type: "paragraph",
            spans: [{ text: content, styles: [] }],
            alignment,
            indent,
          });
          return;
        }

        // Fallback: extract text content for other HTML
        const textContent = raw.replace(/<[^>]+>/g, "").trim();
        if (textContent) {
          nodes.push({
            type: "paragraph",
            spans: [{ text: textContent, styles: [] }],
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
            spans: [{ text: token.text, styles: [] }],
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
