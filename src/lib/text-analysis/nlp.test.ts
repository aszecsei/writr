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

  it("tags parts of speech needed for opener categorization", async () => {
    const [sentence] = await parseParagraph(
      "The quick fox walked into a dark forest.",
      0,
    );
    const tagsOf = (normal: string) =>
      sentence.terms.find((t) => t.normal === normal)?.tags;
    expect(tagsOf("the")).toContain("Determiner");
    expect(tagsOf("quick")).toContain("Adjective");
    expect(tagsOf("fox")).toContain("Noun");
    expect(tagsOf("walked")).toContain("Verb");
    expect(tagsOf("into")).toContain("Preposition");
  });

  it("tags pronouns, conjunctions, adverbs, proper nouns and numbers", async () => {
    const sentences = await parseParagraph(
      "But she quickly left. John bought 42 apples in Paris.",
      0,
    );
    const terms = sentences.flatMap((s) => s.terms);
    const tagsOf = (normal: string) =>
      terms.find((t) => t.normal === normal)?.tags;
    expect(tagsOf("but")).toContain("Conjunction");
    expect(tagsOf("she")).toContain("Pronoun");
    expect(tagsOf("quickly")).toContain("Adverb");
    expect(tagsOf("john")).toContain("ProperNoun");
    expect(tagsOf("paris")).toContain("ProperNoun");
    expect(tagsOf("42")).toContain("NumericValue");
  });

  it("tags passive voice on the auxiliary and participle", async () => {
    const [passive] = await parseParagraph("The ball was thrown by John.", 0);
    expect(passive.terms.some((t) => t.tags.has("Passive"))).toBe(true);

    const [active] = await parseParagraph("John threw the ball.", 0);
    expect(active.terms.some((t) => t.tags.has("Passive"))).toBe(false);
  });

  it("does not tag progressive aspect as passive", async () => {
    const [sentence] = await parseParagraph("The family was running.", 0);
    expect(sentence.terms.some((t) => t.tags.has("Passive"))).toBe(false);
  });

  it("attaches syllable counts from compromise-speech", async () => {
    const [sentence] = await parseParagraph("A beautiful understanding.", 0);
    const syllablesOf = (normal: string) =>
      sentence.terms.find((t) => t.normal === normal)?.syllables;
    expect(syllablesOf("beautiful")).toBe(3);
    expect(syllablesOf("understanding")).toBe(4);
    expect(syllablesOf("a")).toBe(1);
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
