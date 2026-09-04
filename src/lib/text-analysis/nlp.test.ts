import { describe, expect, it } from "vitest";
import { fallbackSyllableCount, parseParagraph } from "./nlp";

/**
 * These tests double as a regression pin on the compromise API surface the
 * adapter depends on: tag names, contraction splitting, syllable output
 * from compromise-speech, and sentence segmentation behavior.
 */
describe("parseParagraph", () => {
  it("segments a paragraph into sentences with terms", async () => {
    const sentences = await parseParagraph(
      "She ran home. The dog barked twice.",
      3,
    );
    expect(sentences).toHaveLength(2);
    expect(sentences[0].text).toBe("She ran home.");
    expect(sentences[0].terms.map((t) => t.normal)).toEqual([
      "she",
      "ran",
      "home",
    ]);
    expect(sentences.every((s) => s.paragraphIndex === 3)).toBe(true);
  });

  it("populates root with the lemma, falling back to normal when unchanged", async () => {
    const [sentence] = await parseParagraph("She wonders about the dogs.", 0);
    const rootOf = (normal: string) =>
      sentence.terms.find((t) => t.normal === normal)?.root;
    // Verb tense and noun number reduce to the lemma...
    expect(rootOf("wonders")).toBe("wonder");
    expect(rootOf("dogs")).toBe("dog");
    // ...and unchanged words still carry a root equal to their normal form.
    expect(rootOf("about")).toBe("about");
  });

  it("normalizes smart apostrophes and drops empty contraction halves", async () => {
    const [sentence] = await parseParagraph("She didn’t answer.", 0);
    const normals = sentence.terms.map((t) => t.normal);
    expect(normals).toContain("didn't");
    expect(normals).not.toContain("");
  });

  it("keeps dialogue attached to the following sentence (known quirk)", async () => {
    // compromise merges a quoted exclamation with the attribution that
    // follows; sentence counts in dialogue-heavy prose run slightly low.
    const sentences = await parseParagraph(
      "“Run!” she said. Mary's book fell.",
      0,
    );
    expect(sentences).toHaveLength(2);
  });

  it("returns no sentences for empty or whitespace input", async () => {
    expect(await parseParagraph("", 0)).toEqual([]);
    expect(await parseParagraph("   ", 0)).toEqual([]);
  });
});

describe("fallbackSyllableCount", () => {
  it("counts vowel groups with a floor of one", () => {
    expect(fallbackSyllableCount("strength")).toBe(1);
    expect(fallbackSyllableCount("rhythm")).toBe(1);
    expect(fallbackSyllableCount("idea")).toBe(2);
  });

  it("returns zero for non-letter input", () => {
    expect(fallbackSyllableCount("42")).toBe(0);
    expect(fallbackSyllableCount("—")).toBe(0);
  });
});
