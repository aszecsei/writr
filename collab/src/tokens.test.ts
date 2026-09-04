import { describe, expect, it } from "vitest";
import { findTokenRole, tokensEqual } from "./tokens.js";

describe("tokensEqual", () => {
  it("returns true for identical strings", () => {
    expect(tokensEqual("abc", "abc")).toBe(true);
  });

  it("returns false for differing strings of equal length", () => {
    expect(tokensEqual("abc", "abd")).toBe(false);
  });

  it("returns false for strings of different lengths without throwing", () => {
    expect(tokensEqual("abc", "abcd")).toBe(false);
    expect(tokensEqual("", "x")).toBe(false);
  });
});

describe("findTokenRole", () => {
  it("returns the role assigned to the matching token", () => {
    const map = new Map<string, "view" | "edit">([
      ["v-tok", "view"],
      ["e-tok", "edit"],
    ]);
    expect(findTokenRole("e-tok", map.entries())).toBe("edit");
    expect(findTokenRole("v-tok", map.entries())).toBe("view");
  });

  it("returns undefined when no token matches", () => {
    const map = new Map<string, "view">([["v-tok", "view"]]);
    expect(findTokenRole("nope", map.entries())).toBeUndefined();
  });
});
