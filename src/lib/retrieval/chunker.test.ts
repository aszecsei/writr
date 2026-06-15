import { describe, expect, it } from "vitest";
import { chunkText } from "./chunker";

const words = (n: number) =>
  Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    expect(chunkText("a short paragraph")).toEqual(["a short paragraph"]);
  });

  it("returns empty array for blank input", () => {
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("packs paragraphs up to maxWords", () => {
    const text = `${words(10)}\n\n${words(10)}\n\n${words(10)}`;
    const chunks = chunkText(text, { maxWords: 20, overlapWords: 0 });
    expect(chunks).toHaveLength(2);
  });

  it("overlaps consecutive chunks", () => {
    const text = `${words(20)}\n\n${words(20)}`;
    const chunks = chunkText(text, { maxWords: 20, overlapWords: 5 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const firstTail = chunks[0].split(" ").slice(-5).join(" ");
    expect(chunks[1].startsWith(firstTail)).toBe(true);
  });

  it("treats a horizontal rule as a hard boundary and drops it", () => {
    const text = `first para\n\n***\n\nsecond para`;
    const chunks = chunkText(text, { maxWords: 100, overlapWords: 0 });
    expect(chunks).toEqual(["first para", "second para"]);
  });

  it("hard-splits an oversized paragraph", () => {
    const chunks = chunkText(words(50), { maxWords: 20, overlapWords: 5 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.split(" ").length).toBeLessThanOrEqual(20);
    }
  });
});
