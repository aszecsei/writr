import { describe, expect, it } from "vitest";
import { formatReadingTime, formatReadingTimeCompact } from "./reading-time";

describe.each([
  {
    name: "formatReadingTime",
    fn: formatReadingTime,
    zero: "< 1 min",
    one: "1 min",
    two: "2 min",
    five: "5 min",
    fiftyNine: "59 min",
    hour1: "1h",
    hour2: "2h",
    combined1: "1h 15m",
    combined2: "2h 30m",
  },
  {
    name: "formatReadingTimeCompact",
    fn: formatReadingTimeCompact,
    zero: "<1m",
    one: "1m",
    two: "2m",
    five: "5m",
    fiftyNine: "59m",
    hour1: "1h",
    hour2: "2h",
    combined1: "1h15m",
    combined2: "2h30m",
  },
])(
  "$name",
  ({
    fn,
    zero,
    one,
    two,
    five,
    fiftyNine,
    hour1,
    hour2,
    combined1,
    combined2,
  }) => {
    it("returns the zero-word label", () => {
      expect(fn(0)).toBe(zero);
    });

    it("rounds up partial minutes", () => {
      expect(fn(50)).toBe(one);
      expect(fn(199)).toBe(one);
      expect(fn(201)).toBe(two);
    });

    it("returns minutes for word counts under an hour", () => {
      expect(fn(1000)).toBe(five);
      expect(fn(11800)).toBe(fiftyNine);
    });

    it("returns hours for word counts over an hour", () => {
      expect(fn(12000)).toBe(hour1);
      expect(fn(24000)).toBe(hour2);
    });

    it("returns hours and minutes combined", () => {
      expect(fn(15000)).toBe(combined1);
      expect(fn(30000)).toBe(combined2);
    });

    it("respects custom WPM", () => {
      expect(fn(100, 100)).toBe(one);
      expect(fn(6000, 100)).toBe(hour1);
    });
  },
);
