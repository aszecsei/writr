import { describe, expect, it } from "vitest";
import {
  escapeRegExp,
  extractSnippet,
  getFirstMatchingField,
  splitByMatch,
  textContainsQuery,
} from "./highlight";

describe("escapeRegExp", () => {
  it("escapes special regex characters", () => {
    expect(escapeRegExp("hello.world")).toBe("hello\\.world");
    expect(escapeRegExp("a*b+c?")).toBe("a\\*b\\+c\\?");
    expect(escapeRegExp("(test)")).toBe("\\(test\\)");
    expect(escapeRegExp("[abc]")).toBe("\\[abc\\]");
    expect(escapeRegExp("a{1,2}")).toBe("a\\{1,2\\}");
    expect(escapeRegExp("a|b")).toBe("a\\|b");
    expect(escapeRegExp("^start$")).toBe("\\^start\\$");
    expect(escapeRegExp("back\\slash")).toBe("back\\\\slash");
  });

  it("leaves normal text unchanged", () => {
    expect(escapeRegExp("hello world")).toBe("hello world");
    expect(escapeRegExp("test123")).toBe("test123");
  });
});

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

  it("returns single non-match part when no query", () => {
    expect(splitByMatch("hello", "")).toEqual([
      { text: "hello", isMatch: false },
    ]);
  });

  it("returns single non-match part when no match found", () => {
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

describe("textContainsQuery", () => {
  it("returns false for empty text or query", () => {
    expect(textContainsQuery("", "test")).toBe(false);
    expect(textContainsQuery("hello", "")).toBe(false);
    expect(textContainsQuery(undefined, "test")).toBe(false);
  });

  it("finds match in string", () => {
    expect(textContainsQuery("hello world", "world")).toBe(true);
    expect(textContainsQuery("hello world", "xyz")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(textContainsQuery("Hello World", "HELLO")).toBe(true);
    expect(textContainsQuery("HELLO WORLD", "hello")).toBe(true);
  });

  it("finds match in array of strings", () => {
    expect(textContainsQuery(["foo", "bar", "baz"], "bar")).toBe(true);
    expect(textContainsQuery(["foo", "bar", "baz"], "xyz")).toBe(false);
  });

  it("is case-insensitive for arrays", () => {
    expect(textContainsQuery(["Foo", "Bar"], "foo")).toBe(true);
  });
});

describe("getFirstMatchingField", () => {
  it("returns null when no fields match", () => {
    const entity = { title: "hello", content: "world" };
    const result = getFirstMatchingField(entity, ["title", "content"], "xyz");
    expect(result).toBeNull();
  });

  it("returns first matching string field", () => {
    const entity = { title: "hello", content: "world" };
    const result = getFirstMatchingField(entity, ["title", "content"], "hello");
    expect(result).toEqual({ field: "title", value: "hello" });
  });

  it("checks fields in order", () => {
    const entity = { title: "test", content: "test" };
    const result = getFirstMatchingField(entity, ["title", "content"], "test");
    expect(result?.field).toBe("title");
  });

  it("finds match in array field", () => {
    const entity = { name: "Alice", aliases: ["Al", "Ally"] };
    const result = getFirstMatchingField(entity, ["name", "aliases"], "ally");
    expect(result).toEqual({ field: "aliases", value: "Ally" });
  });

  it("is case-insensitive", () => {
    const entity = { title: "Hello World" };
    const result = getFirstMatchingField(entity, ["title"], "HELLO");
    expect(result).toEqual({ field: "title", value: "Hello World" });
  });

  it("skips non-string/non-array fields", () => {
    const entity = { title: "test", count: 42 };
    const result = getFirstMatchingField(entity, ["count", "title"], "test");
    expect(result?.field).toBe("title");
  });
});
