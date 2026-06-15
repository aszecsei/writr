import { describe, expect, it } from "vitest";
import { hashText } from "./hash";

describe("hashText", () => {
  it("is deterministic for the same input", () => {
    expect(hashText("hello world")).toBe(hashText("hello world"));
  });

  it("differs for different inputs", () => {
    expect(hashText("a")).not.toBe(hashText("b"));
  });

  it("returns an 8-char hex string", () => {
    expect(hashText("anything")).toMatch(/^[0-9a-f]{8}$/);
  });

  it("handles empty string", () => {
    expect(hashText("")).toMatch(/^[0-9a-f]{8}$/);
  });
});
