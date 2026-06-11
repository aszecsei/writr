import { describe, expect, it } from "vitest";
import { paragraphDensityLevel } from "./paragraphs";

describe("paragraphDensityLevel", () => {
  it("maps average sentence length onto the 0–4 scale at each breakpoint", () => {
    expect(paragraphDensityLevel({ sentenceCount: 1, wordCount: 8 })).toBe(0);
    expect(paragraphDensityLevel({ sentenceCount: 1, wordCount: 9 })).toBe(1);
    expect(paragraphDensityLevel({ sentenceCount: 1, wordCount: 14 })).toBe(1);
    expect(paragraphDensityLevel({ sentenceCount: 1, wordCount: 15 })).toBe(2);
    expect(paragraphDensityLevel({ sentenceCount: 1, wordCount: 20 })).toBe(2);
    expect(paragraphDensityLevel({ sentenceCount: 1, wordCount: 21 })).toBe(3);
    expect(paragraphDensityLevel({ sentenceCount: 1, wordCount: 26 })).toBe(3);
    expect(paragraphDensityLevel({ sentenceCount: 1, wordCount: 27 })).toBe(4);
  });

  it("averages across the paragraph's sentences", () => {
    // 30 words over 3 sentences = avg 10 → level 1, despite the bulk.
    expect(paragraphDensityLevel({ sentenceCount: 3, wordCount: 30 })).toBe(1);
  });

  it("treats an empty paragraph as the lightest level", () => {
    expect(paragraphDensityLevel({ sentenceCount: 0, wordCount: 0 })).toBe(0);
  });
});
