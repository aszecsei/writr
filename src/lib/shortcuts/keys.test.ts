// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  bufferMatches,
  ChordTracker,
  formatBinding,
  isPlainKey,
  isSequenceSpec,
  matchCombo,
  parseBinding,
} from "./keys";

function ev(
  key: string,
  mods: Partial<{
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
  }> = {},
): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, ...mods });
}

describe("isSequenceSpec", () => {
  it("treats space-separated specs as sequences", () => {
    expect(isSequenceSpec("g o")).toBe(true);
    expect(isSequenceSpec("Mod+K")).toBe(false);
    expect(isSequenceSpec("?")).toBe(false);
  });
});

describe("parseBinding", () => {
  it("parses a combo into modifier flags and a lowercased key", () => {
    const parsed = parseBinding("Mod+Shift+F");
    expect(parsed).toEqual({
      kind: "combo",
      combo: {
        mod: true,
        ctrl: false,
        meta: false,
        alt: false,
        shift: true,
        key: "f",
      },
    });
  });

  it("parses a sequence into lowercased tokens", () => {
    expect(parseBinding("g o")).toEqual({
      kind: "sequence",
      tokens: ["g", "o"],
    });
  });

  it("throws when a combo has no key", () => {
    expect(() => parseBinding("Mod+Shift")).toThrow(/no key/);
  });
});

describe("matchCombo", () => {
  const mod = (spec: string) => {
    const p = parseBinding(spec);
    if (p.kind !== "combo") throw new Error("expected combo");
    return p.combo;
  };

  it("resolves Mod to Meta on macOS and Ctrl elsewhere", () => {
    const combo = mod("Mod+K");
    expect(matchCombo(combo, ev("k", { metaKey: true }), true)).toBe(true);
    expect(matchCombo(combo, ev("k", { ctrlKey: true }), true)).toBe(false);

    expect(matchCombo(combo, ev("k", { ctrlKey: true }), false)).toBe(true);
    expect(matchCombo(combo, ev("k", { metaKey: true }), false)).toBe(false);
  });

  it("rejects an alphanumeric combo when an unwanted Shift is held", () => {
    expect(
      matchCombo(
        mod("Mod+K"),
        ev("k", { ctrlKey: true, shiftKey: true }),
        false,
      ),
    ).toBe(false);
  });

  it("requires Shift when the spec lists it", () => {
    const combo = mod("Mod+Shift+F");
    expect(
      matchCombo(combo, ev("F", { ctrlKey: true, shiftKey: true }), false),
    ).toBe(true);
    expect(matchCombo(combo, ev("f", { ctrlKey: true }), false)).toBe(false);
  });

  it("matches a shifted symbol key without enforcing Shift", () => {
    expect(matchCombo(mod("?"), ev("?", { shiftKey: true }), false)).toBe(true);
    expect(matchCombo(mod("?"), ev("?"), false)).toBe(true);
  });

  it("rejects when extra modifiers are present", () => {
    expect(matchCombo(mod("?"), ev("?", { ctrlKey: true }), false)).toBe(false);
  });
});

describe("isPlainKey", () => {
  it("accepts single keys without Ctrl/Meta/Alt", () => {
    expect(isPlainKey(ev("g"))).toBe(true);
    expect(isPlainKey(ev("g", { shiftKey: true }))).toBe(true);
  });

  it("rejects modified or named keys", () => {
    expect(isPlainKey(ev("g", { ctrlKey: true }))).toBe(false);
    expect(isPlainKey(ev("Escape"))).toBe(false);
  });
});

describe("bufferMatches", () => {
  it("matches against the tail of the buffer", () => {
    expect(bufferMatches(["x", "g", "o"], ["g", "o"])).toBe(true);
    expect(bufferMatches(["g", "x"], ["g", "o"])).toBe(false);
    expect(bufferMatches(["o"], ["g", "o"])).toBe(false);
  });
});

describe("ChordTracker", () => {
  it("accumulates keys typed within the timeout", () => {
    const tracker = new ChordTracker(1000);
    tracker.push("g", 0);
    expect(bufferMatches(tracker.push("o", 500), ["g", "o"])).toBe(true);
  });

  it("resets the buffer when the gap exceeds the timeout", () => {
    const tracker = new ChordTracker(1000);
    tracker.push("g", 0);
    expect(bufferMatches(tracker.push("o", 2000), ["g", "o"])).toBe(false);
  });
});

describe("formatBinding", () => {
  it("renders combos per platform", () => {
    expect(formatBinding("Mod+Shift+F", true)).toBe("⌘⇧F");
    expect(formatBinding("Mod+Shift+F", false)).toBe("Ctrl+Shift+F");
  });

  it("renders sequences as 'X then Y'", () => {
    expect(formatBinding("g o", false)).toBe("G then O");
  });

  it("labels named keys", () => {
    expect(formatBinding("Escape", false)).toBe("Esc");
  });
});
