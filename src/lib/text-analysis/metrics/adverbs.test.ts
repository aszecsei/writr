import { describe, expect, it } from "vitest";
import { term } from "../test-helpers";
import { tallyAdverbs } from "./adverbs";

describe("tallyAdverbs", () => {
  it("counts tagged adverbs by tag, not the -ly suffix", () => {
    // "family" ends in -ly but is a noun; "fast" is a flat adverb.
    const tally = tallyAdverbs([
      term("quickly", "Adverb"),
      term("very", "Adverb"),
      term("ran", "Verb", "PastTense"),
      term("softly", "Adverb"),
      term("family", "Noun", "Singular"),
      term("fast", "Adverb"),
    ]);
    expect(tally).toEqual({ adverbs: 4, lyAdverbs: 2 });
  });

  it("returns zeros for no terms", () => {
    expect(tallyAdverbs([])).toEqual({ adverbs: 0, lyAdverbs: 0 });
  });
});
