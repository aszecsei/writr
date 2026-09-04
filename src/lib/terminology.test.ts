import { describe, expect, it } from "vitest";
import { getTerm } from "./terminology";

describe("getTerm", () => {
  it("looks up the term for the given mode", () => {
    expect(getTerm("prose", "chapter")).toBe("Chapter");
    expect(getTerm("screenplay", "chapter")).toBe("Sequence");
  });

  it("falls back to prose when mode is null", () => {
    expect(getTerm(null, "chapter")).toBe("Chapter");
    expect(getTerm(null, "book")).toBe("Book");
  });
});
