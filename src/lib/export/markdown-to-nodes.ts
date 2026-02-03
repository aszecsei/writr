import { Lexer, type Token, type Tokens } from "marked";
import { match } from "ts-pattern";

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
