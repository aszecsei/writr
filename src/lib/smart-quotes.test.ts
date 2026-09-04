import type { Node } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { codeBlock, doc, hardBreak, p, text } from "@/test/pm-schema";
import { convertToSmartQuotes } from "./smart-quotes";

function paragraph(value: string): Node {
  return value ? p(text(value)) : p();
}

function codeBlockParagraph(value: string): Node {
  return value ? codeBlock(text(value)) : codeBlock();
}

function codeParagraph(value: string): Node {
  return p(text(value, ["code"]));
}

function markedParagraph(value: string, ...markNames: string[]): Node {
  return p(text(value, markNames));
}

function mixedParagraph(
  ...segments: Array<{ text: string; marks?: string[] }>
): Node {
  return p(...segments.map(({ text: value, marks }) => text(value, marks)));
}

describe("convertToSmartQuotes", () => {
  it("converts double quotes to smart double quotes", () => {
    const d = doc(paragraph('"Hello," she said.'));
    const result = convertToSmartQuotes(d);

    expect(result).toHaveLength(2);
    expect(result[0].replacement).toBe("“"); // left double quote
    expect(result[1].replacement).toBe("”"); // right double quote
  });

  it("converts single quotes to smart single quotes", () => {
    const d = doc(paragraph("'Hello,' she said."));
    const result = convertToSmartQuotes(d);

    expect(result).toHaveLength(2);
    expect(result[0].replacement).toBe("‘"); // left single quote
    expect(result[1].replacement).toBe("’"); // right single quote
  });

  it("converts apostrophes in contractions", () => {
    const d = doc(paragraph("don't can't it's"));
    const result = convertToSmartQuotes(d);

    expect(result).toHaveLength(3);
    for (const r of result) {
      expect(r.replacement).toBe("’"); // right single quote (apostrophe)
    }
  });

  it("handles nested quotes", () => {
    const d = doc(paragraph("\"She said, 'hello.'\""));
    const result = convertToSmartQuotes(d);

    expect(result).toHaveLength(4);
    expect(result[0].replacement).toBe("“"); // opening "
    expect(result[1].replacement).toBe("‘"); // opening '
    expect(result[2].replacement).toBe("’"); // closing '
    expect(result[3].replacement).toBe("”"); // closing "
  });

  it("skips code blocks", () => {
    const d = doc(codeBlockParagraph('"hello"'));
    const result = convertToSmartQuotes(d);

    expect(result).toHaveLength(0);
  });

  it("skips inline code marks", () => {
    const d = doc(codeParagraph('"hello"'));
    const result = convertToSmartQuotes(d);

    expect(result).toHaveLength(0);
  });

  it("leaves already-smart quotes alone", () => {
    const d = doc(paragraph("“Hello,” she said."));
    const result = convertToSmartQuotes(d);

    expect(result).toHaveLength(0);
  });

  it("handles quotes after opening punctuation", () => {
    const d = doc(paragraph('("hello")'));
    const result = convertToSmartQuotes(d);

    expect(result).toHaveLength(2);
    expect(result[0].replacement).toBe("“"); // left double quote after (
    expect(result[1].replacement).toBe("”"); // right double quote before )
  });

  it("handles empty text", () => {
    const d = doc(paragraph(""));
    const result = convertToSmartQuotes(d);

    expect(result).toHaveLength(0);
  });

  it("returns correct positions", () => {
    // "Hi" -> positions should map to actual doc positions
    const d = doc(paragraph('"Hi"'));
    const result = convertToSmartQuotes(d);

    expect(result).toHaveLength(2);
    // In a doc > paragraph > text, the text starts at pos 1
    // (doc open tag = 0, paragraph open tag = 1, text starts at 1)
    expect(result[0].from).toBe(1); // opening "
    expect(result[0].to).toBe(2);
    expect(result[1].from).toBe(4); // closing "
    expect(result[1].to).toBe(5);
  });

  it("handles multiple paragraphs", () => {
    const d = doc(paragraph('"First."'), paragraph('"Second."'));
    const result = convertToSmartQuotes(d);

    expect(result).toHaveLength(4);
    expect(result[0].replacement).toBe("“");
    expect(result[1].replacement).toBe("”");
    expect(result[2].replacement).toBe("“");
    expect(result[3].replacement).toBe("”");
  });

  it("captures no marks for unformatted text", () => {
    const d = doc(paragraph('"hello"'));
    const result = convertToSmartQuotes(d);

    expect(result).toHaveLength(2);
    for (const r of result) {
      expect(r.marks).toEqual([]);
    }
  });

  it("captures marks when quotes are inside an italic span", () => {
    const d = doc(markedParagraph('"hello"', "em"));
    const result = convertToSmartQuotes(d);

    expect(result).toHaveLength(2);
    for (const r of result) {
      expect(r.marks).toHaveLength(1);
      expect(r.marks[0].type.name).toBe("em");
    }
  });

  it("captures multiple marks for nested formatting", () => {
    const d = doc(markedParagraph('"hi"', "em", "strong"));
    const result = convertToSmartQuotes(d);

    expect(result).toHaveLength(2);
    for (const r of result) {
      const names = r.marks.map((m) => m.type.name).sort();
      expect(names).toEqual(["em", "strong"]);
    }
  });

  it("captures the correct marks per segment in mixed-mark paragraphs", () => {
    // `*"hi"* and "bye"` — first pair italic, second pair plain
    const d = doc(
      mixedParagraph({ text: '"hi"', marks: ["em"] }, { text: ' and "bye"' }),
    );
    const result = convertToSmartQuotes(d);

    expect(result).toHaveLength(4);
    // First pair: inside the italic segment
    expect(result[0].marks.map((m) => m.type.name)).toEqual(["em"]);
    expect(result[1].marks.map((m) => m.type.name)).toEqual(["em"]);
    // Second pair: in the unmarked segment
    expect(result[2].marks).toEqual([]);
    expect(result[3].marks).toEqual([]);
  });

  it("classifies the closing quote after an italic span as closing", () => {
    // `"*Uso!*" She slapped the glass.` — the second `"` sits at the
    // start of a fresh (unmarked) text node, but its preceding character (`!`
    // from the italic span) must still drive the classification.
    const d = doc(
      mixedParagraph(
        { text: '"' },
        { text: "Uso!", marks: ["em"] },
        { text: '" She slapped the glass.' },
      ),
    );
    const result = convertToSmartQuotes(d);

    expect(result).toHaveLength(2);
    expect(result[0].replacement).toBe("“"); // opening "
    expect(result[1].replacement).toBe("”"); // closing "
    // Sanity-check positions: " at start of paragraph content, " right after `Uso!`.
    expect(result[0].from).toBe(1);
    expect(result[1].from).toBe(6);
  });

  it("recognises a contraction apostrophe across a mark boundary", () => {
    // `*don*'t` — italic `don` followed by plain `'t`. The apostrophe is
    // at index 0 of the second text node; without prevChar threading we'd
    // misclassify it as opening-context (prev=""). With threading, prev=`n`
    // and next=`t`, so it's a contraction.
    const d = doc(
      mixedParagraph({ text: "don", marks: ["em"] }, { text: "'t" }),
    );
    const result = convertToSmartQuotes(d);

    expect(result).toHaveLength(1);
    expect(result[0].replacement).toBe("’"); // contraction apostrophe
  });

  it("resets quote context after a hard break", () => {
    // Paragraph: `hello"<br>"world"` — the `"` immediately after the
    // hardBreak should open, not close (the line break is whitespace-like).
    const d = doc(p(text('hello"'), hardBreak(), text('"world"')));
    const result = convertToSmartQuotes(d);

    expect(result).toHaveLength(3);
    expect(result[0].replacement).toBe("”"); // closing after `hello`
    expect(result[1].replacement).toBe("“"); // opening after hardBreak
    expect(result[2].replacement).toBe("”"); // closing after `world`
  });
});
