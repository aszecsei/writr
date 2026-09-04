import { describe, expect, it } from "vitest";
import { meanFromSums, stdDevFromSums } from "./sentences";

describe("meanFromSums", () => {
  it("computes the mean and guards division by zero", () => {
    expect(meanFromSums(30, 3)).toBe(10);
    expect(meanFromSums(0, 0)).toBe(0);
  });
});

describe("stdDevFromSums", () => {
  it("matches a naive standard deviation", () => {
    const lengths = [4, 8, 15, 16, 23, 42];
    const sum = lengths.reduce((a, b) => a + b, 0);
    const sumSq = lengths.reduce((a, b) => a + b * b, 0);
    const mean = sum / lengths.length;
    const naive = Math.sqrt(
      lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length,
    );
    expect(stdDevFromSums(sum, sumSq, lengths.length)).toBeCloseTo(naive, 10);
  });

  it("is 0 for uniform lengths and empty input", () => {
    expect(stdDevFromSums(50, 500, 5)).toBe(0);
    expect(stdDevFromSums(0, 0, 0)).toBe(0);
  });
});
