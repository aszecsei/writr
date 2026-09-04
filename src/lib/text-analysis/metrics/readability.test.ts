import { describe, expect, it } from "vitest";
import { fleschReadingEase, readabilityBand } from "./readability";

describe("fleschReadingEase", () => {
  it("matches a hand-computed score", () => {
    // 10 words, 1 sentence, 13 syllables:
    // 206.835 − 1.015·10 − 84.6·1.3 = 86.705
    expect(fleschReadingEase(10, 1, 13)).toBeCloseTo(86.705, 3);
  });

  it("clamps to the 0–100 range", () => {
    // Long polysyllabic sentence pushes the raw score negative.
    expect(fleschReadingEase(40, 1, 120)).toBe(0);
    // Tiny monosyllabic sentences push it above 100.
    expect(fleschReadingEase(2, 1, 2)).toBe(100);
  });

  it("returns 0 when there are no words or sentences", () => {
    expect(fleschReadingEase(0, 0, 0)).toBe(0);
    expect(fleschReadingEase(0, 1, 0)).toBe(0);
    expect(fleschReadingEase(10, 0, 12)).toBe(0);
  });
});

describe("readabilityBand", () => {
  it("switches bands at each documented threshold", () => {
    expect(readabilityBand(90)).toBe("Very easy");
    expect(readabilityBand(89.9)).toBe("Easy");
    expect(readabilityBand(80)).toBe("Easy");
    expect(readabilityBand(79.9)).toBe("Fairly easy");
    expect(readabilityBand(70)).toBe("Fairly easy");
    expect(readabilityBand(69.9)).toBe("Standard");
    expect(readabilityBand(60)).toBe("Standard");
    expect(readabilityBand(59.9)).toBe("Fairly difficult");
    expect(readabilityBand(50)).toBe("Fairly difficult");
    expect(readabilityBand(49.9)).toBe("Difficult");
    expect(readabilityBand(30)).toBe("Difficult");
    expect(readabilityBand(29.9)).toBe("Very difficult");
    expect(readabilityBand(0)).toBe("Very difficult");
  });
});
