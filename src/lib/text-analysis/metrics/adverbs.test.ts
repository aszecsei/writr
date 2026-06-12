import { describe, expect, it } from "vitest";
import type { AnalyzedTerm } from "../types";
import { tallyAdverbs } from "./adverbs";

function term(normal: string, ...tags: string[]): AnalyzedTerm {
  return { normal, root: normal, tags: new Set(tags), syllables: 1 };
}

describe("tallyAdverbs", () => {
  it("counts tagged adverbs and the -ly subset", () => {
    const tally = tallyAdverbs([
      term("quickly", "Adverb"),
      term("very", "Adverb"),
      term("ran", "Verb", "PastTense"),
      term("softly", "Adverb"),
    ]);
    expect(tally).toEqual({ adverbs: 3, lyAdverbs: 2 });
  });

  it("relies on tags, not the -ly suffix", () => {
    // "family" ends in -ly but is a noun; "fast" is a flat adverb.
    const tally = tallyAdverbs([
      term("family", "Noun", "Singular"),
      term("fast", "Adverb"),
    ]);
    expect(tally).toEqual({ adverbs: 1, lyAdverbs: 0 });
  });

  it("returns zeros for no terms", () => {
    expect(tallyAdverbs([])).toEqual({ adverbs: 0, lyAdverbs: 0 });
  });
});
