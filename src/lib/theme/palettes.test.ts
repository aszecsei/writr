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
} from "./palettes";

const HEX_REGEX = /^#[0-9a-f]{6}$/;

describe("PRIMARY_PALETTES", () => {
  it("has valid hex values for every shade of every palette", () => {
    for (const name of PRIMARY_COLOR_NAMES) {
      for (const shade of SHADE_KEYS) {
        expect(PRIMARY_PALETTES[name][shade]).toMatch(HEX_REGEX);
      }
    }
  });
});

describe("NEUTRAL_PALETTES", () => {
  it("has valid hex values for every shade of every palette", () => {
    for (const name of NEUTRAL_COLOR_NAMES) {
      for (const shade of SHADE_KEYS) {
        expect(NEUTRAL_PALETTES[name][shade]).toMatch(HEX_REGEX);
      }
    }
  });
});

describe("option metadata", () => {
  it("PRIMARY_OPTIONS and NEUTRAL_OPTIONS match their palette names with valid hex swatches", () => {
    expect(PRIMARY_OPTIONS.map((o) => o.name)).toEqual(PRIMARY_COLOR_NAMES);
    expect(NEUTRAL_OPTIONS.map((o) => o.name)).toEqual(NEUTRAL_COLOR_NAMES);
    for (const opt of [...PRIMARY_OPTIONS, ...NEUTRAL_OPTIONS]) {
      expect(opt.swatch).toMatch(HEX_REGEX);
    }
  });
});

describe("EDITOR_WIDTH_OPTIONS", () => {
  it("each option has a CSS value", () => {
    for (const opt of EDITOR_WIDTH_OPTIONS) {
      expect(opt.css).toBeTruthy();
    }
  });
});
