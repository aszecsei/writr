import { type Node, Schema } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { findLineBreakPairs } from "./normalize-line-breaks";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    heading: { content: "inline*", group: "block" },
    codeBlock: {
      content: "text*",
      group: "block",
      code: true,
      parseDOM: [{ tag: "pre" }],
    },
    text: { group: "inline" },
    hardBreak: { inline: true, group: "inline", selectable: false },
  },
});

const br = () => schema.node("hardBreak");
const t = (text: string) => schema.text(text);

function makeDoc(...content: Node[]) {
  return schema.node("doc", null, content);
}

function makeParagraph(...content: Node[]) {
  return schema.node("paragraph", null, content);
}

function makeHeading(...content: Node[]) {
  return schema.node("heading", null, content);
}

describe("findLineBreakPairs", () => {
  it("finds a single pair between text", () => {
    // <p>A<br><br>B</p>
    // positions: A=1, br=2, br=3, B=4
    const doc = makeDoc(makeParagraph(t("A"), br(), br(), t("B")));
    const pairs = findLineBreakPairs(doc);

    expect(pairs).toEqual([{ from: 2, to: 4 }]);
  });

  it("leaves a leftover hardBreak when run length is odd", () => {
    // <p>A<br><br><br>B</p>
    const doc = makeDoc(makeParagraph(t("A"), br(), br(), br(), t("B")));
    const pairs = findLineBreakPairs(doc);

    // Only the first two are paired; the third is leftover.
    expect(pairs).toEqual([{ from: 2, to: 4 }]);
  });

  it("emits non-overlapping pairs for a run of four", () => {
    // <p>A<br><br><br><br>B</p>
    const doc = makeDoc(makeParagraph(t("A"), br(), br(), br(), br(), t("B")));
    const pairs = findLineBreakPairs(doc);

    expect(pairs).toEqual([
      { from: 2, to: 4 },
      { from: 4, to: 6 },
    ]);
  });

  it("handles a pair at the start of a paragraph", () => {
    // <p><br><br>A</p>
    const doc = makeDoc(makeParagraph(br(), br(), t("A")));
    const pairs = findLineBreakPairs(doc);

    expect(pairs).toEqual([{ from: 1, to: 3 }]);
  });

  it("handles a pair at the end of a paragraph", () => {
    // <p>A<br><br></p>
    const doc = makeDoc(makeParagraph(t("A"), br(), br()));
    const pairs = findLineBreakPairs(doc);

    expect(pairs).toEqual([{ from: 2, to: 4 }]);
  });

  it("ignores a single non-adjacent hardBreak", () => {
    // <p>A<br>B</p>
    const doc = makeDoc(makeParagraph(t("A"), br(), t("B")));
    const pairs = findLineBreakPairs(doc);

    expect(pairs).toEqual([]);
  });

  it("ignores non-adjacent breaks separated by text", () => {
    // <p><br>text<br></p>
    const doc = makeDoc(makeParagraph(br(), t("text"), br()));
    const pairs = findLineBreakPairs(doc);

    expect(pairs).toEqual([]);
  });

  it("finds pairs across multiple paragraphs", () => {
    // <p>A<br><br>B</p><p>C<br><br>D</p>
    const doc = makeDoc(
      makeParagraph(t("A"), br(), br(), t("B")),
      makeParagraph(t("C"), br(), br(), t("D")),
    );
    const pairs = findLineBreakPairs(doc);

    // First paragraph spans positions 0..6, second starts at pos 6.
    // Inside second paragraph: C=7, br=8, br=9, D=10 → pair { from: 8, to: 10 }.
    expect(pairs).toEqual([
      { from: 2, to: 4 },
      { from: 8, to: 10 },
    ]);
  });

  it("skips hardBreaks inside headings", () => {
    const doc = makeDoc(makeHeading(t("A"), br(), br(), t("B")));
    const pairs = findLineBreakPairs(doc);

    expect(pairs).toEqual([]);
  });

  it("returns empty for empty paragraph", () => {
    const doc = makeDoc(makeParagraph());
    const pairs = findLineBreakPairs(doc);

    expect(pairs).toEqual([]);
  });

  it("returns empty for paragraph with text but no breaks", () => {
    const doc = makeDoc(makeParagraph(t("Hello world")));
    const pairs = findLineBreakPairs(doc);

    expect(pairs).toEqual([]);
  });
});
