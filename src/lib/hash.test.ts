import { describe, expect, it } from "vitest";
import { hashText } from "./hash";

describe("hashText", () => {
  it("matches a known FNV-1a vector", () => {
    expect(hashText("")).toBe("811c9dc5");
  });
});
