import { describe, expect, it } from "vitest";
import { chunkTextForTts } from "./chunk";

describe("chunkTextForTts", () => {
  it("returns [] for empty or whitespace-only input", () => {
    expect(chunkTextForTts("")).toEqual([]);
    expect(chunkTextForTts("   \n\n  \t  ")).toEqual([]);
  });

  it("returns a single chunk for short input", () => {
    expect(chunkTextForTts("Hello world.")).toEqual(["Hello world."]);
  });

  it("packs paragraphs up to maxChars", () => {
    const p1 = "a".repeat(20);
    const p2 = "b".repeat(20);
    const p3 = "c".repeat(20);
    const result = chunkTextForTts(`${p1}\n\n${p2}\n\n${p3}`, 50);
    // First two paragraphs join with `\n\n` (20+2+20 = 42 ≤ 50);
    // third paragraph is too big to add, so it goes in its own chunk.
    expect(result).toEqual([`${p1}\n\n${p2}`, p3]);
  });

  it("splits an oversized paragraph by sentences", () => {
    const sentence = "This is a sentence.";
    const longParagraph = Array(10).fill(sentence).join(" ");
    const result = chunkTextForTts(longParagraph, 60);
    expect(result.length).toBeGreaterThan(1);
    for (const piece of result) {
      expect(piece.length).toBeLessThanOrEqual(60);
    }
    expect(result.join(" ")).toEqual(longParagraph);
  });

  it("falls back to single-newline splits for soft-wrapped paragraphs", () => {
    // 200-char "paragraph" with no double newlines but many single newlines
    const lines = Array(20).fill("0123456789"); // 200 chars
    const blob = lines.join("\n");
    const result = chunkTextForTts(blob, 50);
    expect(result.length).toBeGreaterThan(1);
    for (const piece of result) {
      expect(piece.length).toBeLessThanOrEqual(50);
    }
  });

  it("falls back to char windowing when a single sentence exceeds maxChars", () => {
    const giant = "x".repeat(250);
    const result = chunkTextForTts(giant, 100);
    expect(result).toEqual(["x".repeat(100), "x".repeat(100), "x".repeat(50)]);
  });

  it("rejects non-positive maxChars", () => {
    expect(() => chunkTextForTts("hello", 0)).toThrow();
    expect(() => chunkTextForTts("hello", -1)).toThrow();
  });
});
