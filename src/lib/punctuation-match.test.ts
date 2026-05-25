import { describe, expect, it } from "vitest";
import {
  countNormalizedOccurrences,
  normalizedIncludes,
  normalizedIndexOf,
  normalizePunctuation,
} from "./punctuation-match";

describe("normalizePunctuation", () => {
  it("folds curly single quotes and apostrophes to '", () => {
    expect(normalizePunctuation("‘x’")).toBe("'x'");
    expect(normalizePunctuation("don’t")).toBe("don't");
    expect(normalizePunctuation("‚a‛b")).toBe("'a'b");
    expect(normalizePunctuation("5′")).toBe("5'");
  });

  it('folds curly double quotes and primes to "', () => {
    expect(normalizePunctuation("“x”")).toBe('"x"');
    expect(normalizePunctuation("„a‟b")).toBe('"a"b');
    expect(normalizePunctuation("12″")).toBe('12"');
  });

  it("folds non-breaking space to regular space", () => {
    expect(normalizePunctuation("a b")).toBe("a b");
    expect(normalizePunctuation("a b").charCodeAt(1)).toBe(0x20);
  });

  it("preserves length (1:1 mapping)", () => {
    const input = "“Don’t,” she said. 5′ 6″ tall — a hyphen.";
    expect(normalizePunctuation(input).length).toBe(input.length);
  });

  it("leaves non-mapped characters untouched", () => {
    expect(normalizePunctuation("hello — world …")).toBe("hello — world …");
    expect(normalizePunctuation("")).toBe("");
    expect(normalizePunctuation("ASCII only")).toBe("ASCII only");
  });
});

describe("normalizedIndexOf", () => {
  it("finds straight-quoted needle in smart-quoted haystack", () => {
    const haystack = "She said “hello” to him.";
    const needle = 'said "hello"';
    const idx = normalizedIndexOf(haystack, needle);
    expect(idx).toBe(haystack.indexOf("said "));
    // The returned index is into the *original* haystack — verify the slice
    // length equals the needle length so callers can splice safely.
    expect(haystack.slice(idx, idx + needle.length)).toBe("said “hello”");
  });

  it("finds smart-quoted needle in straight-quoted haystack", () => {
    const haystack = 'She said "hello" to him.';
    const needle = "said “hello”";
    const idx = normalizedIndexOf(haystack, needle);
    expect(idx).toBe(haystack.indexOf("said "));
  });

  it("matches apostrophes in either direction", () => {
    const smart = "don’t";
    const straight = "don't";
    expect(normalizedIndexOf(smart, straight)).toBe(0);
    expect(normalizedIndexOf(straight, smart)).toBe(0);
  });

  it("returns -1 when needle is genuinely absent", () => {
    expect(normalizedIndexOf("She said “hello”", "goodbye")).toBe(-1);
  });

  it("respects fromIndex", () => {
    const haystack = "a “b” c “b” d";
    const first = normalizedIndexOf(haystack, '"b"');
    const second = normalizedIndexOf(haystack, '"b"', first + 1);
    expect(second).toBeGreaterThan(first);
    expect(haystack.slice(second, second + 3)).toBe("“b”");
  });
});

describe("normalizedIncludes", () => {
  it("is true for cross-form matches", () => {
    expect(normalizedIncludes("She said “hi”.", 'said "hi"')).toBe(true);
    expect(normalizedIncludes("don’t", "don't")).toBe(true);
  });

  it("is false when text genuinely differs", () => {
    expect(normalizedIncludes("She said “hi”.", 'said "bye"')).toBe(false);
  });
});

describe("countNormalizedOccurrences", () => {
  it("counts matches across mixed punctuation forms", () => {
    const haystack = 'She said "hi". She said “hi”. She said ‘hi’.';
    expect(countNormalizedOccurrences(haystack, 'said "hi"')).toBe(2);
    expect(countNormalizedOccurrences(haystack, "said 'hi'")).toBe(1);
  });

  it("returns 0 for empty needle", () => {
    expect(countNormalizedOccurrences("anything", "")).toBe(0);
  });

  it("returns 0 for needle not present", () => {
    expect(countNormalizedOccurrences("She said “hi”", "goodbye")).toBe(0);
  });

  it("counts non-overlapping occurrences", () => {
    expect(countNormalizedOccurrences("aaaa", "aa")).toBe(2);
  });
});
