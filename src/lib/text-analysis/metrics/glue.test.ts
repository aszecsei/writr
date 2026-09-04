import { describe, expect, it } from "vitest";
import { rootedTerm, sentence, term } from "../test-helpers";
import { checkSticky, countGlueWords } from "./glue";

function sentenceOf(normals: string[]) {
  return sentence(normals.map((n) => term(n)));
}

describe("countGlueWords", () => {
  it("counts an inflected generic verb via its lemma without enumerating it", () => {
    // "seeming" is not in the glue list, but its lemma "seem" is. Rooting
    // catches it, closing gaps the hand-maintained inflection list misses.
    const terms = [
      term("the"),
      term("plan"),
      rootedTerm("seeming", "seem"),
      term("solid"),
    ];
    expect(countGlueWords(terms)).toBe(2); // "the" + "seeming"→"seem"
  });

  it("still counts an irregular form compromise leaves unrooted", () => {
    // "got" stays "got" (no reduction); the explicit list catches it via the
    // surface form, so rooting never regresses existing matches.
    const terms = [term("she"), term("got"), term("cold")];
    expect(countGlueWords(terms)).toBe(2); // "she" + "got"
  });
});

describe("checkSticky", () => {
  it("flags a long sentence with more than 40% glue", () => {
    const s = sentenceOf([
      "it",
      "was",
      "in",
      "the",
      "way",
      "of",
      "the",
      "dragon",
    ]);
    const result = checkSticky(s, 7);
    expect(result).not.toBeNull();
    expect(result?.sentenceIndex).toBe(7);
    // it, was, in, the, of, the — "way" and "dragon" are content words.
    expect(result?.gluePct).toBeCloseTo(6 / 8, 5);
    expect(result?.wordCount).toBe(8);
  });

  it("does not flag sentences at or below the threshold", () => {
    const s = sentenceOf([
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
    expect(checkSticky(s, 0)).toBeNull();
  });

  it("ignores short sentences regardless of glue share", () => {
    const s = sentenceOf(["it", "was", "in", "the", "way"]);
    expect(checkSticky(s, 0)).toBeNull();
  });
});
