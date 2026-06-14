import { afterEach, describe, expect, it, vi } from "vitest";
import { pickRandom, randomChance } from "./random";

describe("pickRandom", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns undefined for an empty array", () => {
    expect(pickRandom([])).toBeUndefined();
  });

  it("returns the only element of a singleton array", () => {
    expect(pickRandom(["solo"])).toBe("solo");
  });

  it("selects the first element when Math.random is at its minimum", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pickRandom(["a", "b", "c"])).toBe("a");
  });

  it("selects the last element when Math.random approaches 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    expect(pickRandom(["a", "b", "c"])).toBe("c");
  });

  it("maps mid-range Math.random to the corresponding index", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(pickRandom(["a", "b", "c", "d"])).toBe("c");
  });
});

describe("randomChance", () => {
  it("is always false at p <= 0 without consulting the source", () => {
    const source = vi.fn(() => 0);
    expect(randomChance(0, source)).toBe(false);
    expect(randomChance(-0.5, source)).toBe(false);
    expect(source).not.toHaveBeenCalled();
  });

  it("is always true at p >= 1 without consulting the source", () => {
    const source = vi.fn(() => 0.999);
    expect(randomChance(1, source)).toBe(true);
    expect(randomChance(1.5, source)).toBe(true);
    expect(source).not.toHaveBeenCalled();
  });

  it("returns true when the draw falls below p", () => {
    expect(randomChance(0.3, () => 0.29)).toBe(true);
  });

  it("returns false when the draw is at or above p", () => {
    expect(randomChance(0.3, () => 0.3)).toBe(false);
    expect(randomChance(0.3, () => 0.5)).toBe(false);
  });

  it("defaults to Math.random when no source is given", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    expect(randomChance(0.5)).toBe(true);
  });
});
