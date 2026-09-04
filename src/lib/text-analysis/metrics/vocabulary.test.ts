import { describe, expect, it } from "vitest";
import { MTLD_MIN_TOKENS } from "../thresholds";
import { mtld, ttrFromFrequency } from "./vocabulary";

describe("ttrFromFrequency", () => {
  it("is 1 when every word is unique", () => {
    const { ttr } = ttrFromFrequency({ alpha: 1, beta: 1, gamma: 1 });
    expect(ttr).toBe(1);
  });

  it("falls with repetition", () => {
    const { ttr, rootTtr } = ttrFromFrequency({ alpha: 8, beta: 2 });
    expect(ttr).toBeCloseTo(0.2, 5);
    expect(rootTtr).toBeCloseTo(2 / Math.sqrt(10), 5);
  });

  it("returns zeros for an empty map", () => {
    expect(ttrFromFrequency({})).toEqual({ ttr: 0, rootTtr: 0 });
  });
});

describe("mtld", () => {
  it("returns null below the token minimum", () => {
    const tokens = Array.from({ length: MTLD_MIN_TOKENS - 1 }, (_, i) =>
      String(i),
    );
    expect(mtld(tokens)).toBeNull();
  });

  it("is high for maximally diverse text", () => {
    const tokens = Array.from({ length: 100 }, (_, i) => `word${i}`);
    const result = mtld(tokens);
    // All-unique text never crosses the TTR threshold; MTLD caps at the
    // token count.
    expect(result).toBe(100);
  });

  it("is low for highly repetitive text", () => {
    const tokens = Array.from({ length: 100 }, (_, i) =>
      i % 2 === 0 ? "ping" : "pong",
    );
    const result = mtld(tokens);
    expect(result).not.toBeNull();
    expect(result as number).toBeLessThan(10);
  });

  it("ranks more diverse text above less diverse text of equal length", () => {
    const diverse = Array.from({ length: 200 }, (_, i) => `w${i % 50}`);
    const repetitive = Array.from({ length: 200 }, (_, i) => `w${i % 5}`);
    expect(mtld(diverse) as number).toBeGreaterThan(mtld(repetitive) as number);
  });
});
