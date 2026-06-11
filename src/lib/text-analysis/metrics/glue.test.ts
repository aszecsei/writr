import { describe, expect, it } from "vitest";
import type { AnalyzedSentence, AnalyzedTerm } from "../types";
import { checkSticky, countGlueWords, makeExcerpt } from "./glue";

function term(normal: string): AnalyzedTerm {
  return { normal, tags: new Set(), syllables: 1 };
}

function sentenceOf(normals: string[], text?: string): AnalyzedSentence {
  return {
    text: text ?? normals.join(" "),
    terms: normals.map(term),
    paragraphIndex: 0,
  };
}

describe("countGlueWords", () => {
  it("counts words present in the glue list", () => {
    const sentence = sentenceOf(["the", "dragon", "was", "in", "flames"]);
    expect(countGlueWords(sentence.terms)).toBe(3);
  });
});

describe("checkSticky", () => {
  it("flags a long sentence with more than 40% glue", () => {
    const sentence = sentenceOf([
      "it",
      "was",
      "in",
      "the",
      "way",
      "of",
      "the",
      "dragon",
    ]);
    const result = checkSticky(sentence, 7);
    expect(result).not.toBeNull();
    expect(result?.sentenceIndex).toBe(7);
    // it, was, in, the, of, the — "way" and "dragon" are content words.
    expect(result?.gluePct).toBeCloseTo(6 / 8, 5);
    expect(result?.wordCount).toBe(8);
  });

  it("does not flag sentences at or below the threshold", () => {
    const sentence = sentenceOf([
      "the",
      "crimson",
      "dragon",
      "devoured",
      "seven",
      "knights",
      "near",
      "dawn",
      "yesterday",
      "evening",
    ]);
    expect(checkSticky(sentence, 0)).toBeNull();
  });

  it("ignores short sentences regardless of glue share", () => {
    const sentence = sentenceOf(["it", "was", "in", "the", "way"]);
    expect(checkSticky(sentence, 0)).toBeNull();
  });
});

describe("makeExcerpt", () => {
  it("returns short text unchanged", () => {
    expect(makeExcerpt("Short sentence.")).toBe("Short sentence.");
  });

  it("truncates long text with an ellipsis", () => {
    const long = "x".repeat(120);
    const excerpt = makeExcerpt(long);
    expect(excerpt.length).toBeLessThanOrEqual(80);
    expect(excerpt.endsWith("…")).toBe(true);
  });
});
