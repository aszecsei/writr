import { type Node, Schema } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { convertToSmartQuotes } from "./smart-quotes";

// Minimal ProseMirror schema for testing
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    codeBlock: {
      content: "text*",
      group: "block",
      code: true,
      parseDOM: [{ tag: "pre" }],
    },
    text: { group: "inline" },
    hardBreak: {
      group: "inline",
      inline: true,
      selectable: false,
      parseDOM: [{ tag: "br" }],
    },
  },
  marks: {
    code: {
      parseDOM: [{ tag: "code" }],
    },
    em: {
      parseDOM: [{ tag: "em" }],
    },
    strong: {
      parseDOM: [{ tag: "strong" }],
    },
  },
});

function makeDoc(...content: Node[]) {
  return schema.node("doc", null, content);
}

function makeParagraph(text: string) {
  return schema.node("paragraph", null, text ? [schema.text(text)] : []);
}

function makeCodeBlock(text: string) {
  return schema.node("codeBlock", null, text ? [schema.text(text)] : []);
}

function makeCodeParagraph(text: string) {
  return schema.node("paragraph", null, [
    schema.text(text, [schema.mark("code")]),
  ]);
}

function makeMarkedParagraph(text: string, ...markNames: string[]) {
  const marks = markNames.map((name) => schema.mark(name));
  return schema.node("paragraph", null, [schema.text(text, marks)]);
}

function makeMixedParagraph(
  ...segments: Array<{ text: string; marks?: string[] }>
) {
  return schema.node(
    "paragraph",
    null,
    segments.map(({ text, marks = [] }) =>
      schema.text(
        text,
        marks.map((name) => schema.mark(name)),
      ),
    ),
  );
}

describe("convertToSmartQuotes", () => {
  it("converts double quotes to smart double quotes", () => {
    const doc = makeDoc(makeParagraph('"Hello," she said.'));
    const result = convertToSmartQuotes(doc);

    expect(result).toHaveLength(2);
    expect(result[0].replacement).toBe("\u201C"); // left double quote
    expect(result[1].replacement).toBe("\u201D"); // right double quote
  });

  it("converts single quotes to smart single quotes", () => {
    const doc = makeDoc(makeParagraph("'Hello,' she said."));
    const result = convertToSmartQuotes(doc);

    expect(result).toHaveLength(2);
    expect(result[0].replacement).toBe("\u2018"); // left single quote
    expect(result[1].replacement).toBe("\u2019"); // right single quote
  });

  it("converts apostrophes in contractions", () => {
    const doc = makeDoc(makeParagraph("don't can't it's"));
    const result = convertToSmartQuotes(doc);

    expect(result).toHaveLength(3);
    for (const r of result) {
      expect(r.replacement).toBe("\u2019"); // right single quote (apostrophe)
    }
  });

  it("handles nested quotes", () => {
    const doc = makeDoc(makeParagraph("\"She said, 'hello.'\""));
    const result = convertToSmartQuotes(doc);

    expect(result).toHaveLength(4);
    expect(result[0].replacement).toBe("\u201C"); // opening "
    expect(result[1].replacement).toBe("\u2018"); // opening '
    expect(result[2].replacement).toBe("\u2019"); // closing '
    expect(result[3].replacement).toBe("\u201D"); // closing "
  });

  it("skips code blocks", () => {
    const doc = makeDoc(makeCodeBlock('"hello"'));
    const result = convertToSmartQuotes(doc);

    expect(result).toHaveLength(0);
  });

  it("skips inline code marks", () => {
    const doc = makeDoc(makeCodeParagraph('"hello"'));
    const result = convertToSmartQuotes(doc);

    expect(result).toHaveLength(0);
  });

  it("leaves already-smart quotes alone", () => {
    const doc = makeDoc(makeParagraph("\u201CHello,\u201D she said."));
    const result = convertToSmartQuotes(doc);

    expect(result).toHaveLength(0);
  });

  it("handles quotes after opening punctuation", () => {
    const doc = makeDoc(makeParagraph('("hello")'));
    const result = convertToSmartQuotes(doc);

    expect(result).toHaveLength(2);
    expect(result[0].replacement).toBe("\u201C"); // left double quote after (
    expect(result[1].replacement).toBe("\u201D"); // right double quote before )
  });

  it("handles empty text", () => {
    const doc = makeDoc(makeParagraph(""));
    const result = convertToSmartQuotes(doc);

    expect(result).toHaveLength(0);
  });

  it("returns correct positions", () => {
    // "Hi" -> positions should map to actual doc positions
    const doc = makeDoc(makeParagraph('"Hi"'));
    const result = convertToSmartQuotes(doc);

    expect(result).toHaveLength(2);
    // In a doc > paragraph > text, the text starts at pos 1
    // (doc open tag = 0, paragraph open tag = 1, text starts at 1)
    expect(result[0].from).toBe(1); // opening "
    expect(result[0].to).toBe(2);
    expect(result[1].from).toBe(4); // closing "
    expect(result[1].to).toBe(5);
  });

  it("handles multiple paragraphs", () => {
    const doc = makeDoc(makeParagraph('"First."'), makeParagraph('"Second."'));
    const result = convertToSmartQuotes(doc);

    expect(result).toHaveLength(4);
    expect(result[0].replacement).toBe("\u201C");
    expect(result[1].replacement).toBe("\u201D");
    expect(result[2].replacement).toBe("\u201C");
    expect(result[3].replacement).toBe("\u201D");
  });

  it("captures no marks for unformatted text", () => {
    const doc = makeDoc(makeParagraph('"hello"'));
    const result = convertToSmartQuotes(doc);

    expect(result).toHaveLength(2);
    for (const r of result) {
      expect(r.marks).toEqual([]);
    }
  });

  it("captures marks when quotes are inside an italic span", () => {
    const doc = makeDoc(makeMarkedParagraph('"hello"', "em"));
    const result = convertToSmartQuotes(doc);

    expect(result).toHaveLength(2);
    for (const r of result) {
      expect(r.marks).toHaveLength(1);
      expect(r.marks[0].type.name).toBe("em");
    }
  });

  it("captures multiple marks for nested formatting", () => {
    const doc = makeDoc(makeMarkedParagraph('"hi"', "em", "strong"));
    const result = convertToSmartQuotes(doc);

    expect(result).toHaveLength(2);
    for (const r of result) {
      const names = r.marks.map((m) => m.type.name).sort();
      expect(names).toEqual(["em", "strong"]);
    }
  });

  it("captures the correct marks per segment in mixed-mark paragraphs", () => {
    // `*"hi"* and "bye"` \u2014 first pair italic, second pair plain
    const doc = makeDoc(
      makeMixedParagraph(
        { text: '"hi"', marks: ["em"] },
        { text: ' and "bye"' },
      ),
    );
    const result = convertToSmartQuotes(doc);

    expect(result).toHaveLength(4);
    // First pair: inside the italic segment
    expect(result[0].marks.map((m) => m.type.name)).toEqual(["em"]);
    expect(result[1].marks.map((m) => m.type.name)).toEqual(["em"]);
    // Second pair: in the unmarked segment
    expect(result[2].marks).toEqual([]);
    expect(result[3].marks).toEqual([]);
  });

  it("classifies the closing quote after an italic span as closing", () => {
    // `"*Uso!*" She slapped the glass.` \u2014 the second `"` sits at the
    // start of a fresh (unmarked) text node, but its preceding character (`!`
    // from the italic span) must still drive the classification.
    const doc = makeDoc(
      makeMixedParagraph(
        { text: '"' },
        { text: "Uso!", marks: ["em"] },
        { text: '" She slapped the glass.' },
      ),
    );
    const result = convertToSmartQuotes(doc);

    expect(result).toHaveLength(2);
    expect(result[0].replacement).toBe("\u201c"); // opening "
    expect(result[1].replacement).toBe("\u201d"); // closing " (was wrongly opening)
    // Sanity-check positions: " at start of paragraph content, " right after `Uso!`.
    expect(result[0].from).toBe(1);
    expect(result[1].from).toBe(6);
  });

  it("classifies a closing quote after an italic word as closing", () => {
    // `"*hello*" world` \u2014 simpler variant of the above, no trailing
    // punctuation inside the italic span.
    const doc = makeDoc(
      makeMixedParagraph(
        { text: '"' },
        { text: "hello", marks: ["em"] },
        { text: '" world' },
      ),
    );
    const result = convertToSmartQuotes(doc);

    expect(result).toHaveLength(2);
    expect(result[0].replacement).toBe("\u201c");
    expect(result[1].replacement).toBe("\u201d");
  });

  it("recognises a contraction apostrophe across a mark boundary", () => {
    // `*don*'t` \u2014 italic `don` followed by plain `'t`. The apostrophe is
    // at index 0 of the second text node; without prevChar threading we'd
    // misclassify it as opening-context (prev=""). With threading, prev=`n`
    // and next=`t`, so it's a contraction.
    const doc = makeDoc(
      makeMixedParagraph({ text: "don", marks: ["em"] }, { text: "'t" }),
    );
    const result = convertToSmartQuotes(doc);

    expect(result).toHaveLength(1);
    expect(result[0].replacement).toBe("\u2019"); // contraction apostrophe
  });

  it("resets quote context after a hard break", () => {
    // Paragraph: `hello"<br>"world"` \u2014 the `"` immediately after the
    // hardBreak should open, not close (the line break is whitespace-like).
    const paragraph = schema.node("paragraph", null, [
      schema.text('hello"'),
      schema.node("hardBreak"),
      schema.text('"world"'),
    ]);
    const doc = makeDoc(paragraph);
    const result = convertToSmartQuotes(doc);

    expect(result).toHaveLength(3);
    expect(result[0].replacement).toBe("\u201d"); // closing after `hello`
    expect(result[1].replacement).toBe("\u201c"); // opening after hardBreak
    expect(result[2].replacement).toBe("\u201d"); // closing after `world`
  });
});
