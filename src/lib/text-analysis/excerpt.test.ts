import { describe, expect, it } from "vitest";
import { makeExcerpt } from "./excerpt";

describe("makeExcerpt", () => {
  it("returns short text unchanged", () => {
    expect(makeExcerpt("Short sentence.")).toBe("Short sentence.");
  });

  it("truncates long text with an ellipsis", () => {
    const long = "x".repeat(120);
    const excerpt = makeExcerpt(long);
    expect(excerpt.length).toBeLessThanOrEqual(80);
    expect(excerpt.endsWith("…")).toBe(true);
  });
});
