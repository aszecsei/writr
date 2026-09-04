import { describe, expect, it } from "vitest";
import {
  bucketForLength,
  echoSeverity,
  paragraphDensityLevel,
  readabilityBand,
} from "./presentation";
import { echoAt } from "./test-helpers";

describe("echoSeverity", () => {
  it("marks four or more occurrences dense regardless of spacing", () => {
    expect(echoSeverity(echoAt([0, 5, 10, 15]))).toBe("dense");
  });

  it("marks three tightly-packed occurrences dense", () => {
    expect(echoSeverity(echoAt([0, 1, 4]))).toBe("dense");
  });

  it("keeps three spread-out occurrences an ordinary echo", () => {
    expect(echoSeverity(echoAt([0, 2, 4]))).toBe("echo");
  });

  it("keeps two occurrences an ordinary echo even when adjacent", () => {
    expect(echoSeverity(echoAt([0, 1]))).toBe("echo");
  });
});

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

describe("readabilityBand", () => {
  it("switches bands at each documented threshold", () => {
    expect(readabilityBand(90)).toBe("Very easy");
    expect(readabilityBand(89.9)).toBe("Easy");
    expect(readabilityBand(80)).toBe("Easy");
    expect(readabilityBand(79.9)).toBe("Fairly easy");
    expect(readabilityBand(70)).toBe("Fairly easy");
    expect(readabilityBand(69.9)).toBe("Standard");
    expect(readabilityBand(60)).toBe("Standard");
    expect(readabilityBand(59.9)).toBe("Fairly difficult");
    expect(readabilityBand(50)).toBe("Fairly difficult");
    expect(readabilityBand(49.9)).toBe("Difficult");
    expect(readabilityBand(30)).toBe("Difficult");
    expect(readabilityBand(29.9)).toBe("Very difficult");
    expect(readabilityBand(0)).toBe("Very difficult");
  });
});

describe("bucketForLength", () => {
  it("switches buckets at the documented boundaries", () => {
    expect(bucketForLength(7)).toBe("short");
    expect(bucketForLength(8)).toBe("medium");
    expect(bucketForLength(19)).toBe("medium");
    expect(bucketForLength(20)).toBe("long");
    expect(bucketForLength(29)).toBe("long");
    expect(bucketForLength(30)).toBe("veryLong");
  });
});
