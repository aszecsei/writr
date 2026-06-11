import { describe, expect, it } from "vitest";
import { segmentSentences } from "./SentenceLengthPreview";

describe("segmentSentences", () => {
  it("returns offsets and word counts for consecutive sentences", () => {
    const text = "She ran. The door was locked.";
    const segments = segmentSentences(text);

    expect(segments).toHaveLength(2);
    expect(text.slice(segments[0].start, segments[0].end)).toBe("She ran.");
    expect(segments[0].wordCount).toBe(2);
    expect(text.slice(segments[1].start, segments[1].end)).toBe(
      "The door was locked.",
    );
    expect(segments[1].wordCount).toBe(4);
  });

  it("trims whitespace from segment ranges", () => {
    const text = "  First.   Second.  ";
    const segments = segmentSentences(text);

    expect(segments).toHaveLength(2);
    expect(text.slice(segments[0].start, segments[0].end)).toBe("First.");
    expect(text.slice(segments[1].start, segments[1].end)).toBe("Second.");
  });

  it("does not count punctuation-only tokens as words", () => {
    const segments = segmentSentences("Well — yes!");
    expect(segments).toHaveLength(1);
    expect(segments[0].wordCount).toBe(2);
  });

  it("returns nothing for empty or whitespace-only input", () => {
    expect(segmentSentences("")).toEqual([]);
    expect(segmentSentences("   \t ")).toEqual([]);
    expect(segmentSentences("…!?")).toEqual([]);
  });

  it("handles text without terminal punctuation", () => {
    const text = "an unfinished thought";
    const segments = segmentSentences(text);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      start: 0,
      end: text.length,
      wordCount: 3,
    });
  });

  describe("regex fallback (no Intl.Segmenter)", () => {
    it("splits on sentence-final punctuation with offsets", () => {
      const text = 'He left. "Why?" she asked.';
      const segments = segmentSentences(text, null);

      expect(segments.length).toBeGreaterThanOrEqual(2);
      expect(text.slice(segments[0].start, segments[0].end)).toBe("He left.");
      expect(segments[0].wordCount).toBe(2);
    });

    it("keeps closing quotes with the sentence", () => {
      const text = "She said “stop.” Then silence.";
      const segments = segmentSentences(text, null);

      expect(segments).toHaveLength(2);
      expect(text.slice(segments[0].start, segments[0].end)).toBe(
        "She said “stop.”",
      );
      expect(text.slice(segments[1].start, segments[1].end)).toBe(
        "Then silence.",
      );
    });

    it("returns nothing for empty input", () => {
      expect(segmentSentences("", null)).toEqual([]);
    });
  });
});
