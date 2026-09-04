// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyEditorWidth,
  applyHoleHighlightOpacity,
  applyNeutralColor,
  applyPrimaryColor,
  applyUiDensity,
} from "./apply-theme";
import { NEUTRAL_PALETTES, PRIMARY_PALETTES, SHADE_KEYS } from "./palettes";

// jsdom provides a real `document`, but Node's own experimental global
// `localStorage` getter (undefined without --localstorage-file) shadows
// jsdom's implementation, so storage still needs a stand-in.
const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: vi.fn((k: string) => storage.get(k) ?? null),
  setItem: vi.fn((k: string, v: string) => storage.set(k, v)),
  removeItem: vi.fn((k: string) => storage.delete(k)),
  clear: vi.fn(() => storage.clear()),
});

beforeEach(() => {
  document.documentElement.removeAttribute("style");
  document.documentElement.removeAttribute("data-density");
  storage.clear();
});

describe("applyPrimaryColor", () => {
  it("sets all shade CSS variables and caches them to localStorage", () => {
    applyPrimaryColor("rose");
    for (const shade of SHADE_KEYS) {
      expect(
        document.documentElement.style.getPropertyValue(`--primary-${shade}`),
      ).toBe(PRIMARY_PALETTES.rose[shade]);
    }
    const cached = JSON.parse(storage.get("writr-primary-vars") ?? "{}");
    expect(cached["--primary-500"]).toBe("#f43f5e");
    expect(storage.get("writr-primary-color")).toBe("rose");
  });
});

describe("applyNeutralColor", () => {
  it("sets all shade CSS variables and caches them to localStorage", () => {
    applyNeutralColor("stone");
    for (const shade of SHADE_KEYS) {
      expect(
        document.documentElement.style.getPropertyValue(`--neutral-${shade}`),
      ).toBe(NEUTRAL_PALETTES.stone[shade]);
    }
    const cached = JSON.parse(storage.get("writr-neutral-vars") ?? "{}");
    expect(cached["--neutral-500"]).toBe("#78716c");
    expect(storage.get("writr-neutral-color")).toBe("stone");
  });
});

describe("applyEditorWidth", () => {
  it("sets --editor-content-width for each width and stores it", () => {
    applyEditorWidth("narrow");
    expect(
      document.documentElement.style.getPropertyValue("--editor-content-width"),
    ).toBe("720px");
    expect(storage.get("writr-editor-width")).toBe("narrow");

    applyEditorWidth("medium");
    expect(
      document.documentElement.style.getPropertyValue("--editor-content-width"),
    ).toBe("900px");

    applyEditorWidth("wide");
    expect(
      document.documentElement.style.getPropertyValue("--editor-content-width"),
    ).toBe("1200px");
  });
});

describe("applyUiDensity", () => {
  it("sets data-density on the html element and stores it", () => {
    applyUiDensity("compact");
    expect(document.documentElement.getAttribute("data-density")).toBe(
      "compact",
    );
    expect(storage.get("writr-density")).toBe("compact");
  });
});

describe("applyHoleHighlightOpacity", () => {
  it("sets --hole-highlight-opacity and stores it", () => {
    applyHoleHighlightOpacity(0.4);
    expect(
      document.documentElement.style.getPropertyValue(
        "--hole-highlight-opacity",
      ),
    ).toBe("0.4");
    expect(storage.get("writr-hole-opacity")).toBe("0.4");
  });

  it("clamps values outside 0–1", () => {
    applyHoleHighlightOpacity(1.5);
    expect(
      document.documentElement.style.getPropertyValue(
        "--hole-highlight-opacity",
      ),
    ).toBe("1");
    applyHoleHighlightOpacity(-0.3);
    expect(
      document.documentElement.style.getPropertyValue(
        "--hole-highlight-opacity",
      ),
    ).toBe("0");
  });
});
