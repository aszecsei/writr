import { describe, expect, it } from "vitest";
import type { ChapterId } from "@/db/schemas";
import { tokenizeChapter, tokenizeText } from "./tokenize";

describe("tokenizeText", () => {
  it("keeps internal apostrophes inside one word", () => {
    expect(tokenizeText("Don't wake O’Brien").map((t) => t.word)).toEqual([
      "don't",
      "wake",
      "o'brien",
    ]);
  });

  it("offsets slice back to the original surface text", () => {
    const text = "  “Well,” she said—quietly.";
    expect(tokenizeText(text).map((t) => text.slice(t.start, t.end))).toEqual([
      "Well",
      "she",
      "said",
      "quietly",
    ]);
  });

  it("splits hyphenated words and punctuation", () => {
    expect(tokenizeText("salt-stained, sea-worn").map((t) => t.word)).toEqual([
      "salt",
      "stained",
      "sea",
      "worn",
    ]);
  });

  it("tokenizes non-Latin letters and digits", () => {
    expect(tokenizeText("Москва 1984 東京").map((t) => t.word)).toEqual([
      "москва",
      "1984",
      "東京",
    ]);
  });
});

describe("tokenizeChapter", () => {
  it("streams tokens across paragraphs, tagged with their paragraph", () => {
    const chapter = tokenizeChapter("c1" as ChapterId, ["One two.", "Three."]);
    expect(chapter.tokens.map((t) => [t.word, t.paragraphIndex])).toEqual([
      ["one", 0],
      ["two", 0],
      ["three", 1],
    ]);
  });
});
