import { describe, expect, it } from "vitest";
import { DEFAULT_HOLE_DELIMITERS, type HoleDelimiters } from "@/lib/holes";
import {
  markdownToPlainParagraphs,
  screenplayToPlainParagraphs,
} from "./strip";

const BRACES: HoleDelimiters = { open: "{{", close: "}}" };

describe("markdownToPlainParagraphs", () => {
  it("splits markdown into one entry per paragraph", () => {
    const result = markdownToPlainParagraphs(
      "First paragraph.\n\nSecond paragraph.",
      DEFAULT_HOLE_DELIMITERS,
    );
    expect(result).toEqual(["First paragraph.", "Second paragraph."]);
  });

  it("unwraps inline emphasis, code spans and links", () => {
    const result = markdownToPlainParagraphs(
      "She *really* meant the `word` — see [the note](https://x.test).",
      DEFAULT_HOLE_DELIMITERS,
    );
    expect(result).toEqual(["She really meant the word — see the note."]);
  });

  it("drops headings entirely", () => {
    const result = markdownToPlainParagraphs(
      "# Chapter One\n\nThe prose begins.",
      DEFAULT_HOLE_DELIMITERS,
    );
    expect(result).toEqual(["The prose begins."]);
  });

  it("drops code blocks, horizontal rules and images", () => {
    const result = markdownToPlainParagraphs(
      "Before.\n\n```\nconst x = 1;\n```\n\n---\n\n![alt](img.png)\n\nAfter.",
      DEFAULT_HOLE_DELIMITERS,
    );
    expect(result).toEqual(["Before.", "After."]);
  });

  it("flattens blockquotes and list items into paragraphs", () => {
    const result = markdownToPlainParagraphs(
      "> A quoted line.\n\n- first item\n- second item",
      DEFAULT_HOLE_DELIMITERS,
    );
    expect(result).toEqual(["A quoted line.", "first item", "second item"]);
  });

  it("strips holes with default or custom delimiters", () => {
    expect(
      markdownToPlainParagraphs(
        "She opened the door. [describe the hallway] Then she ran.",
        DEFAULT_HOLE_DELIMITERS,
      ),
    ).toEqual(["She opened the door.  Then she ran."]);
    expect(
      markdownToPlainParagraphs("Alpha {{fix this later}} omega.", BRACES),
    ).toEqual(["Alpha  omega."]);
  });

  it("drops paragraphs that were entirely a hole", () => {
    const result = markdownToPlainParagraphs(
      "Real prose.\n\n[whole missing scene]",
      DEFAULT_HOLE_DELIMITERS,
    );
    expect(result).toEqual(["Real prose."]);
  });

  it("returns empty array for empty input", () => {
    expect(markdownToPlainParagraphs("", DEFAULT_HOLE_DELIMITERS)).toEqual([]);
  });
});

describe("screenplayToPlainParagraphs", () => {
  it("splits on blank lines and joins wrapped lines", () => {
    const result = screenplayToPlainParagraphs(
      "INT. HOUSE - NIGHT\n\nJOHN\nI can't believe it.\n\nHe slams the door.",
      DEFAULT_HOLE_DELIMITERS,
    );
    expect(result).toEqual([
      "INT. HOUSE - NIGHT",
      "JOHN I can't believe it.",
      "He slams the door.",
    ]);
  });

  it("drops page breaks and unwraps centered markers", () => {
    const result = screenplayToPlainParagraphs(
      "> THE END <\n\n===\n\nFADE OUT.",
      DEFAULT_HOLE_DELIMITERS,
    );
    expect(result).toEqual(["THE END", "FADE OUT."]);
  });

  it("strips holes", () => {
    const result = screenplayToPlainParagraphs(
      "He pauses. [reaction shot]",
      DEFAULT_HOLE_DELIMITERS,
    );
    expect(result).toEqual(["He pauses."]);
  });
});
