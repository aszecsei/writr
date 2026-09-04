import { describe, expect, it } from "vitest";
import { extractSnippet, splitByMatch } from "./highlight";

describe("extractSnippet", () => {
  it("returns empty string for empty text or query", () => {
    expect(extractSnippet("", "test")).toBe("");
    expect(extractSnippet("hello", "")).toBe("");
    expect(extractSnippet("", "")).toBe("");
  });

  it("extracts snippet with context around match", () => {
    const text = "The quick brown fox jumps over the lazy dog";
    const snippet = extractSnippet(text, "fox");
    expect(snippet).toContain("fox");
    expect(snippet).toContain("brown");
    expect(snippet).toContain("jumps");
  });

  it("adds ellipsis when match is not at start", () => {
    const text =
      "This is a very long piece of text with lots of words before we finally get to the word search somewhere in the middle of this sentence";
    const snippet = extractSnippet(text, "search");
    expect(snippet.startsWith("...")).toBe(true);
  });

  it("adds ellipsis when match is not at end", () => {
    const text =
      "The word test appears here and then there is more text after it that continues";
    const snippet = extractSnippet(text, "test");
    expect(snippet.endsWith("...")).toBe(true);
  });

  it("is case-insensitive", () => {
    const text = "Hello World";
    const snippet = extractSnippet(text, "HELLO");
    expect(snippet).toContain("Hello");
  });

  it("returns truncated text when no match found", () => {
    const text = "Short text";
    const snippet = extractSnippet(text, "notfound");
    expect(snippet).toBe("Short text");
  });

  it("truncates long text with no match", () => {
    const longText = "a".repeat(200);
    const snippet = extractSnippet(longText, "notfound");
    expect(snippet.length).toBeLessThanOrEqual(123); // 120 + "..."
    expect(snippet.endsWith("...")).toBe(true);
  });
});

describe("splitByMatch", () => {
  it("returns empty array for empty text", () => {
    expect(splitByMatch("", "test")).toEqual([]);
  });

  it("returns a single non-match part when there's no query or no match", () => {
    expect(splitByMatch("hello", "")).toEqual([
      { text: "hello", isMatch: false },
    ]);
    expect(splitByMatch("hello world", "xyz")).toEqual([
      { text: "hello world", isMatch: false },
    ]);
  });

  it("splits text with single match", () => {
    expect(splitByMatch("hello world", "world")).toEqual([
      { text: "hello ", isMatch: false },
      { text: "world", isMatch: true },
    ]);
  });

  it("splits text with match at start", () => {
    expect(splitByMatch("hello world", "hello")).toEqual([
      { text: "hello", isMatch: true },
      { text: " world", isMatch: false },
    ]);
  });

  it("splits text with multiple matches", () => {
    expect(splitByMatch("test one test two test", "test")).toEqual([
      { text: "test", isMatch: true },
      { text: " one ", isMatch: false },
      { text: "test", isMatch: true },
      { text: " two ", isMatch: false },
      { text: "test", isMatch: true },
    ]);
  });

  it("is case-insensitive but preserves original case", () => {
    expect(splitByMatch("Hello HELLO hello", "hello")).toEqual([
      { text: "Hello", isMatch: true },
      { text: " ", isMatch: false },
      { text: "HELLO", isMatch: true },
      { text: " ", isMatch: false },
      { text: "hello", isMatch: true },
    ]);
  });

  it("handles adjacent matches", () => {
    expect(splitByMatch("aaa", "a")).toEqual([
      { text: "a", isMatch: true },
      { text: "a", isMatch: true },
      { text: "a", isMatch: true },
    ]);
  });
});
