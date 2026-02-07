import { beforeEach, describe, expect, it, vi } from "vitest";
import { NEUTRAL_PALETTES, PRIMARY_PALETTES, SHADE_KEYS } from "./palettes";

// Mock DOM globals
const styleProps = new Map<string, string>();
const attrs = new Map<string, string>();
const storage = new Map<string, string>();

const mockStyle = {
  setProperty: vi.fn((k: string, v: string) => styleProps.set(k, v)),
  getPropertyValue: vi.fn((k: string) => styleProps.get(k) ?? ""),
  removeProperty: vi.fn((k: string) => styleProps.delete(k)),
};

vi.stubGlobal("document", {
  documentElement: {
    style: mockStyle,
    setAttribute: vi.fn((k: string, v: string) => attrs.set(k, v)),
    getAttribute: vi.fn((k: string) => attrs.get(k) ?? null),
    removeAttribute: vi.fn((k: string) => attrs.delete(k)),
  },
});

vi.stubGlobal("localStorage", {
  getItem: vi.fn((k: string) => storage.get(k) ?? null),
  setItem: vi.fn((k: string, v: string) => storage.set(k, v)),
  removeItem: vi.fn((k: string) => storage.delete(k)),
  clear: vi.fn(() => storage.clear()),
});

// Import after mocking
const {
  applyPrimaryColor,
  applyNeutralColor,
  applyEditorWidth,
  applyUiDensity,
} = await import("./apply-theme");

describe("applyPrimaryColor", () => {
  beforeEach(() => {
    styleProps.clear();
    storage.clear();
  });

  it("sets --primary-* CSS variables on document element", () => {
    applyPrimaryColor("blue");
    expect(styleProps.get("--primary-500")).toBe(PRIMARY_PALETTES.blue[500]);
    expect(styleProps.get("--primary-600")).toBe(PRIMARY_PALETTES.blue[600]);
  });

  it("sets all 11 shade variables", () => {
    applyPrimaryColor("rose");
    for (const shade of SHADE_KEYS) {
      expect(styleProps.get(`--primary-${shade}`)).toBe(
        PRIMARY_PALETTES.rose[shade],
      );
    }
  });

  it("caches variables to localStorage", () => {
    applyPrimaryColor("rose");
    const cached = JSON.parse(storage.get("writr-primary-vars") ?? "{}");
    expect(cached["--primary-500"]).toBe("#f43f5e");
  });

  it("stores the color name in localStorage", () => {
    applyPrimaryColor("emerald");
    expect(storage.get("writr-primary-color")).toBe("emerald");
  });
});

describe("applyNeutralColor", () => {
  beforeEach(() => {
    styleProps.clear();
    storage.clear();
  });

  it("sets --neutral-* CSS variables on document element", () => {
    applyNeutralColor("slate");
    expect(styleProps.get("--neutral-500")).toBe(NEUTRAL_PALETTES.slate[500]);
  });

  it("sets all 11 shade variables", () => {
    applyNeutralColor("stone");
    for (const shade of SHADE_KEYS) {
      expect(styleProps.get(`--neutral-${shade}`)).toBe(
        NEUTRAL_PALETTES.stone[shade],
      );
    }
  });

  it("caches variables to localStorage", () => {
    applyNeutralColor("stone");
    const cached = JSON.parse(storage.get("writr-neutral-vars") ?? "{}");
    expect(cached["--neutral-500"]).toBe("#78716c");
  });

  it("stores the color name in localStorage", () => {
    applyNeutralColor("gray");
    expect(storage.get("writr-neutral-color")).toBe("gray");
  });
});

describe("applyEditorWidth", () => {
  beforeEach(() => {
    styleProps.clear();
    storage.clear();
  });

  it("sets --editor-content-width CSS variable", () => {
    applyEditorWidth("wide");
    expect(styleProps.get("--editor-content-width")).toBe("1200px");
  });

  it("handles narrow width", () => {
    applyEditorWidth("narrow");
    expect(styleProps.get("--editor-content-width")).toBe("720px");
  });

  it("handles medium width (default)", () => {
    applyEditorWidth("medium");
    expect(styleProps.get("--editor-content-width")).toBe("900px");
  });

  it("stores width in localStorage", () => {
    applyEditorWidth("narrow");
    expect(storage.get("writr-editor-width")).toBe("narrow");
  });
});

describe("applyUiDensity", () => {
  beforeEach(() => {
    attrs.clear();
    storage.clear();
  });

  it("sets data-density attribute on html element", () => {
    applyUiDensity("compact");
    expect(attrs.get("data-density")).toBe("compact");
  });

  it("stores density in localStorage", () => {
    applyUiDensity("comfortable");
    expect(storage.get("writr-density")).toBe("comfortable");
  });
});
