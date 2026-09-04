import { describe, expect, it } from "vitest";
import {
  buildHoleRegex,
  countHoles,
  countWordsExcludingHoles,
  DEFAULT_HOLE_DELIMITERS,
  findHoles,
  type HoleDelimiters,
  stripHoles,
} from "./holes";

const BRACKETS = DEFAULT_HOLE_DELIMITERS;
const BRACES: HoleDelimiters = { open: "{{", close: "}}" };

describe("buildHoleRegex", () => {
  it("matches a bracketed hole with default delimiters", () => {
    const regex = buildHoleRegex(BRACKETS);
    expect("[a note]".match(regex)).toEqual(["[a note]"]);
  });

  it("falls back to default delimiters when either side is empty", () => {
    const regex = buildHoleRegex({ open: "", close: "" });
    expect("[note]".match(regex)).toEqual(["[note]"]);
  });
});

describe("findHoles", () => {
  it("finds every hole in document order with offsets", () => {
    const text = "Intro [first hole] middle [second hole] end";
    const holes = findHoles(text, BRACKETS);
    expect(holes.map((h) => h.text)).toEqual(["[first hole]", "[second hole]"]);
    expect(holes[0].index).toBe(6);
    expect(holes[0].length).toBe("[first hole]".length);
  });

  it("does not nest — matches the innermost pair", () => {
    const holes = findHoles("[outer [inner] tail]", BRACKETS);
    expect(holes.map((h) => h.text)).toEqual(["[inner]"]);
  });

  it("does not let a hole cross a line boundary", () => {
    const holes = findHoles("[unterminated\nclosed here]", BRACKETS);
    expect(holes).toHaveLength(0);
  });

  it("supports multi-character, regex-special delimiters", () => {
    const holes = findHoles("before {{a.b*c}} after", BRACES);
    expect(holes.map((h) => h.text)).toEqual(["{{a.b*c}}"]);
  });
});

describe("countHoles", () => {
  it("counts holes", () => {
    expect(countHoles("[a] plain [b] [c]", BRACKETS)).toBe(3);
    expect(countHoles("no holes here", BRACKETS)).toBe(0);
  });
});

describe("stripHoles", () => {
  it("removes holes while leaving surrounding prose intact", () => {
    expect(stripHoles("The hero [walks away] slowly.", BRACKETS)).toBe(
      "The hero  slowly.",
    );
  });
});

describe("countWordsExcludingHoles", () => {
  it("counts plain prose normally, excluding hole content", () => {
    expect(countWordsExcludingHoles("a b c d", BRACKETS)).toBe(4);
    expect(
      countWordsExcludingHoles("one two [three four five] six", BRACKETS),
    ).toBe(3);
  });

  it("returns zero for empty or hole-only text", () => {
    expect(countWordsExcludingHoles("", BRACKETS)).toBe(0);
    expect(countWordsExcludingHoles("[just a note]", BRACKETS)).toBe(0);
  });
});
