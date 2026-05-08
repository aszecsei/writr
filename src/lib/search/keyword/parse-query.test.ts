import { describe, expect, it } from "vitest";
import { parseQuery } from "./parse-query";

describe("parseQuery", () => {
  it("returns empty query unchanged", () => {
    expect(parseQuery("")).toEqual({ phrases: [], tokens: "" });
  });

  it("extracts a single quoted phrase", () => {
    expect(parseQuery('"moonlit garden"')).toEqual({
      phrases: ["moonlit garden"],
      tokens: "",
    });
  });

  it("returns plain tokens when no quotes are present", () => {
    expect(parseQuery("garden moon night")).toEqual({
      phrases: [],
      tokens: "garden moon night",
    });
  });

  it("splits a mixed query into phrase and tokens", () => {
    expect(parseQuery('flames "moonlit garden" silver')).toEqual({
      phrases: ["moonlit garden"],
      tokens: "flames silver",
    });
  });

  it("extracts multiple quoted phrases", () => {
    expect(parseQuery('"foo bar" "baz qux"')).toEqual({
      phrases: ["foo bar", "baz qux"],
      tokens: "",
    });
  });

  it("treats unmatched opening quote as literal", () => {
    // No closing double quote → no phrase extracted; tokens preserve the
    // stray character (minisearch's tokenizer drops it).
    expect(parseQuery('"foo bar')).toEqual({
      phrases: [],
      tokens: '"foo bar',
    });
  });

  it("ignores empty quoted strings", () => {
    expect(parseQuery('foo "" bar')).toEqual({
      phrases: [],
      tokens: "foo bar",
    });
  });

  it("preserves apostrophes inside tokens", () => {
    // Single quotes are not phrase delimiters — Bob's stays one token.
    expect(parseQuery("Bob's friend")).toEqual({
      phrases: [],
      tokens: "Bob's friend",
    });
  });

  it("trims whitespace inside extracted phrases", () => {
    expect(parseQuery('"  spaced phrase  "')).toEqual({
      phrases: ["spaced phrase"],
      tokens: "",
    });
  });

  it("collapses whitespace in tokens", () => {
    expect(parseQuery("  many   spaces   here  ")).toEqual({
      phrases: [],
      tokens: "many spaces here",
    });
  });
});
