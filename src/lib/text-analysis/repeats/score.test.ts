import { describe, expect, it } from "vitest";
import { REPEAT_SCORE_REFERENCE_TOKENS } from "../thresholds";
import { repeatWeight } from "./score";

describe("repeatWeight", () => {
  it("equals the word count at the reference length", () => {
    expect(repeatWeight(REPEAT_SCORE_REFERENCE_TOKENS)).toBeCloseTo(
      REPEAT_SCORE_REFERENCE_TOKENS,
    );
  });

  it("more than doubles when the copy doubles in length", () => {
    expect(repeatWeight(40)).toBeGreaterThan(2 * repeatWeight(20));
  });
});
