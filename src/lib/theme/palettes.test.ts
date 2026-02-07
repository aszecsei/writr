import { describe, expect, it } from "vitest";
import {
  EDITOR_WIDTH_OPTIONS,
  NEUTRAL_COLOR_NAMES,
  NEUTRAL_OPTIONS,
  NEUTRAL_PALETTES,
  PRIMARY_COLOR_NAMES,
  PRIMARY_OPTIONS,
  PRIMARY_PALETTES,
  SHADE_KEYS,
  UI_DENSITY_OPTIONS,
} from "./palettes";

const HEX_REGEX = /^#[0-9a-f]{6}$/;

describe("PRIMARY_PALETTES", () => {
  it("has all 10 primary palettes", () => {
    expect(PRIMARY_COLOR_NAMES).toHaveLength(10);
  });

  for (const name of PRIMARY_COLOR_NAMES) {
    describe(name, () => {
      it("has all shade keys (50-950)", () => {
        const palette = PRIMARY_PALETTES[name];
        for (const shade of SHADE_KEYS) {
          expect(palette[shade]).toBeDefined();
        }
      });

      it("has valid hex values for all shades", () => {
        const palette = PRIMARY_PALETTES[name];
        for (const shade of SHADE_KEYS) {
          expect(palette[shade]).toMatch(HEX_REGEX);
        }
      });
    });
  }
});

describe("NEUTRAL_PALETTES", () => {
  it("has all 5 neutral palettes", () => {
    expect(NEUTRAL_COLOR_NAMES).toHaveLength(5);
  });

  for (const name of NEUTRAL_COLOR_NAMES) {
    describe(name, () => {
      it("has all shade keys (50-950)", () => {
        const palette = NEUTRAL_PALETTES[name];
        for (const shade of SHADE_KEYS) {
          expect(palette[shade]).toBeDefined();
        }
      });

      it("has valid hex values for all shades", () => {
        const palette = NEUTRAL_PALETTES[name];
        for (const shade of SHADE_KEYS) {
          expect(palette[shade]).toMatch(HEX_REGEX);
        }
      });
    });
  }
});

describe("option metadata", () => {
  it("PRIMARY_OPTIONS matches palette names", () => {
    const optNames = PRIMARY_OPTIONS.map((o) => o.name);
    expect(optNames).toEqual(PRIMARY_COLOR_NAMES);
  });

  it("NEUTRAL_OPTIONS matches palette names", () => {
    const optNames = NEUTRAL_OPTIONS.map((o) => o.name);
    expect(optNames).toEqual(NEUTRAL_COLOR_NAMES);
  });

  it("PRIMARY_OPTIONS swatch values are valid hex", () => {
    for (const opt of PRIMARY_OPTIONS) {
      expect(opt.swatch).toMatch(HEX_REGEX);
    }
  });

  it("NEUTRAL_OPTIONS swatch values are valid hex", () => {
    for (const opt of NEUTRAL_OPTIONS) {
      expect(opt.swatch).toMatch(HEX_REGEX);
    }
  });
});

describe("EDITOR_WIDTH_OPTIONS", () => {
  it("has 3 options", () => {
    expect(EDITOR_WIDTH_OPTIONS).toHaveLength(3);
  });

  it("each option has a CSS value", () => {
    for (const opt of EDITOR_WIDTH_OPTIONS) {
      expect(opt.css).toBeTruthy();
    }
  });
});

describe("UI_DENSITY_OPTIONS", () => {
  it("has 2 options", () => {
    expect(UI_DENSITY_OPTIONS).toHaveLength(2);
  });
});
