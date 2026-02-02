import { Lexer, type Token, type Tokens } from "marked";

export type InlineStyle = "bold" | "italic" | "code" | "strikethrough";

export interface TextSpan {
  text: string;
  styles: InlineStyle[];
}

export type DocNode =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; spans: TextSpan[] }
  | { type: "paragraph"; spans: TextSpan[] }
  | { type: "blockquote"; children: DocNode[] }
  | { type: "list"; ordered: boolean; items: DocNode[][] }
  | { type: "code"; text: string }
  | { type: "hr" }
  | { type: "pageBreak" };

function parseInlineTokens(
  tokens: Token[] | undefined,
  parentStyles: InlineStyle[] = [],
): TextSpan[] {
  if (!tokens) return [];
  const spans: TextSpan[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "text": {
        const t = token as Tokens.Text;
        if (t.tokens) {
          spans.push(...parseInlineTokens(t.tokens, parentStyles));
        } else {
          spans.push({ text: t.text, styles: [...parentStyles] });
        }
        break;
      }
      case "strong": {
        const t = token as Tokens.Strong;
        spans.push(...parseInlineTokens(t.tokens, [...parentStyles, "bold"]));
        break;
      }
      case "em": {
        const t = token as Tokens.Em;
        spans.push(...parseInlineTokens(t.tokens, [...parentStyles, "italic"]));
        break;
      }
      case "del": {
        const t = token as Tokens.Del;
        spans.push(
          ...parseInlineTokens(t.tokens, [...parentStyles, "strikethrough"]),
        );
        break;
      }
      case "codespan": {
        const t = token as Tokens.Codespan;
        spans.push({ text: t.text, styles: [...parentStyles, "code"] });
        break;
      }
      case "br": {
        spans.push({ text: "\n", styles: [] });
        break;
      }
      case "escape": {
        const t = token as Tokens.Escape;
        spans.push({ text: t.text, styles: [...parentStyles] });
        break;
      }
      case "link": {
        const t = token as Tokens.Link;
        spans.push(...parseInlineTokens(t.tokens, parentStyles));
        break;
      }
      case "image": {
        const t = token as Tokens.Image;
        spans.push({
          text: t.text || t.title || "[image]",
          styles: [...parentStyles],
        });
        break;
      }
      default: {
        if ("text" in token && typeof token.text === "string") {
          spans.push({ text: token.text, styles: [...parentStyles] });
        }
        break;
      }
    }
  }

  return spans;
}

function walkTokens(tokens: Token[]): DocNode[] {
  const nodes: DocNode[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const t = token as Tokens.Heading;
        nodes.push({
          type: "heading",
          level: t.depth as 1 | 2 | 3 | 4 | 5 | 6,
          spans: parseInlineTokens(t.tokens),
        });
        break;
      }
      case "paragraph": {
        const t = token as Tokens.Paragraph;
        nodes.push({
          type: "paragraph",
          spans: parseInlineTokens(t.tokens),
        });
        break;
      }
      case "blockquote": {
        const t = token as Tokens.Blockquote;
        nodes.push({
          type: "blockquote",
          children: walkTokens(t.tokens),
        });
        break;
      }
      case "list": {
        const t = token as Tokens.List;
        nodes.push({
          type: "list",
          ordered: t.ordered,
          items: t.items.map((item) => walkTokens(item.tokens)),
        });
        break;
      }
      case "code": {
        const t = token as Tokens.Code;
        nodes.push({ type: "code", text: t.text });
        break;
      }
      case "hr": {
        nodes.push({ type: "hr" });
        break;
      }
      case "space":
        break;
      default:
        if ("text" in token && typeof token.text === "string") {
          nodes.push({
            type: "paragraph",
            spans: [{ text: token.text, styles: [] }],
          });
        }
        break;
    }
  }

  return nodes;
}

export function markdownToNodes(markdown: string): DocNode[] {
  const tokens = new Lexer().lex(markdown);
  return walkTokens(tokens);
}
