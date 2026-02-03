import { describe, expect, it } from "vitest";
import { formatReadingTime, formatReadingTimeCompact } from "./reading-time";

describe("formatReadingTime", () => {
  it("returns '< 1 min' for 0 words", () => {
    expect(formatReadingTime(0)).toBe("< 1 min");
  });

  it("rounds up partial minutes", () => {
    expect(formatReadingTime(50)).toBe("1 min");
    expect(formatReadingTime(199)).toBe("1 min");
    expect(formatReadingTime(201)).toBe("2 min");
  });

  it("returns minutes for word counts under an hour", () => {
    expect(formatReadingTime(200)).toBe("1 min");
    expect(formatReadingTime(400)).toBe("2 min");
    expect(formatReadingTime(1000)).toBe("5 min");
    expect(formatReadingTime(11800)).toBe("59 min");
  });

  it("returns hours for word counts over an hour", () => {
    expect(formatReadingTime(12000)).toBe("1h");
    expect(formatReadingTime(24000)).toBe("2h");
  });

  it("returns hours and minutes combined", () => {
    expect(formatReadingTime(15000)).toBe("1h 15m");
    expect(formatReadingTime(30000)).toBe("2h 30m");
  });

  it("respects custom WPM", () => {
    expect(formatReadingTime(100, 100)).toBe("1 min");
    expect(formatReadingTime(500, 500)).toBe("1 min");
    expect(formatReadingTime(6000, 100)).toBe("1h");
  });
});

describe("formatReadingTimeCompact", () => {
  it("returns '<1m' for 0 words", () => {
    expect(formatReadingTimeCompact(0)).toBe("<1m");
  });

  it("rounds up partial minutes", () => {
    expect(formatReadingTimeCompact(50)).toBe("1m");
    expect(formatReadingTimeCompact(199)).toBe("1m");
    expect(formatReadingTimeCompact(201)).toBe("2m");
  });

  it("returns minutes for word counts under an hour", () => {
    expect(formatReadingTimeCompact(200)).toBe("1m");
    expect(formatReadingTimeCompact(400)).toBe("2m");
    expect(formatReadingTimeCompact(1000)).toBe("5m");
    expect(formatReadingTimeCompact(11800)).toBe("59m");
  });

  it("returns hours for word counts over an hour", () => {
    expect(formatReadingTimeCompact(12000)).toBe("1h");
    expect(formatReadingTimeCompact(24000)).toBe("2h");
  });

  it("returns hours and minutes combined without space", () => {
    expect(formatReadingTimeCompact(15000)).toBe("1h15m");
    expect(formatReadingTimeCompact(30000)).toBe("2h30m");
  });

  it("respects custom WPM", () => {
    expect(formatReadingTimeCompact(100, 100)).toBe("1m");
    expect(formatReadingTimeCompact(500, 500)).toBe("1m");
    expect(formatReadingTimeCompact(6000, 100)).toBe("1h");
  });
});
