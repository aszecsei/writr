import { describe, expect, it } from "vitest";
import type { BrainstormColumn } from "@/db/schemas";
import { fillPattern, referencedColumnNames } from "./brainstorm";

/** Deterministic rng that returns options at the given index sequence. */
function sequentialRng(indices: number[]): <T>(items: readonly T[]) => T {
  let call = 0;
  return <T>(items: readonly T[]): T => {
    const index = indices[call] ?? 0;
    call += 1;
    return items[index];
  };
}

/** Deterministic float source for optional rolls (defaults to 1 when drained). */
function scriptedRandom(values: number[]): () => number {
  let call = 0;
  return () => {
    const value = values[call] ?? 1;
    call += 1;
    return value;
  };
}

const cols = (...entries: [string, string[]][]): BrainstormColumn[] =>
  entries.map(([name, options]) => ({ name, options }));

describe("fillPattern", () => {
  it("substitutes a single reference and preserves surrounding text exactly", () => {
    const result = fillPattern(
      "A [hero] appears.",
      cols(["hero", ["knight"]]),
      sequentialRng([0]),
    );
    expect(result.entry).toBe("A knight appears.");
    expect(result.hasUnknown).toBe(false);
  });

  it("picks independently for a column referenced twice", () => {
    const result = fillPattern(
      "[c] and [c]",
      cols(["c", ["x", "y"]]),
      sequentialRng([0, 1]),
    );
    expect(result.entry).toBe("x and y");
  });

  it("matches column names case-insensitively after trimming", () => {
    const result = fillPattern(
      "[Character]",
      cols(["character", ["Bob"]]),
      sequentialRng([0]),
    );
    expect(result.entry).toBe("Bob");
    expect(result.hasUnknown).toBe(false);
  });

  it("leaves unknown columns as literal text and flags them", () => {
    const result = fillPattern("[mystery]", cols(["hero", ["knight"]]));
    expect(result.entry).toBe("[mystery]");
    expect(result.hasUnknown).toBe(true);
    expect(result.segments).toEqual([
      { text: "[mystery]", isUnknownColumn: true },
    ]);
  });

  it("treats a column with no options as unknown", () => {
    const result = fillPattern("[empty]", cols(["empty", []]));
    expect(result.entry).toBe("[empty]");
    expect(result.hasUnknown).toBe(true);
  });

  it("reconstructs a multi-reference pattern with literal gaps intact", () => {
    const result = fillPattern(
      "[a] in a [b], wanting [a]",
      cols(["a", ["wolf"]], ["b", ["forest"]]),
      sequentialRng([0, 0, 0]),
    );
    expect(result.entry).toBe("wolf in a forest, wanting wolf");
  });

  it("returns the pattern unchanged when there are no references", () => {
    const result = fillPattern("nothing to fill", []);
    expect(result.entry).toBe("nothing to fill");
    expect(result.hasUnknown).toBe(false);
  });
});

describe("fillPattern — labels and constraints", () => {
  it("reuses a labeled value via a bare constraint", () => {
    const result = fillPattern(
      "[color:a] dog. The [color::a] dog.",
      cols(["color", ["red", "green", "blue"]]),
      sequentialRng([0]),
    );
    expect(result.entry).toBe("red dog. The red dog.");
    expect(result.hasUnknown).toBe(false);
  });

  it("excludes a labeled value via a negated constraint", () => {
    const result = fillPattern(
      "[color:a] [color::!a]",
      cols(["color", ["red", "green"]]),
      // first pick → red (bound to a); second pick draws from [green] only
      sequentialRng([0, 0]),
    );
    expect(result.entry).toBe("red green");
    expect(result.hasUnknown).toBe(false);
  });

  it("treats an exclusion against an unbound label as a no-op", () => {
    const result = fillPattern(
      "[color::!b]",
      cols(["color", ["red", "green"]]),
      sequentialRng([1]),
    );
    expect(result.entry).toBe("green");
    expect(result.hasUnknown).toBe(false);
  });

  it("flags an over-constrained reference as unknown", () => {
    const result = fillPattern(
      "[color:a][color::!a]",
      cols(["color", ["red"]]),
      sequentialRng([0]),
    );
    expect(result.entry).toBe("red[color::!a]");
    expect(result.hasUnknown).toBe(true);
    expect(result.segments).toEqual([
      { text: "red", isUnknownColumn: false },
      { text: "[color::!a]", isUnknownColumn: true },
    ]);
  });

  it("flags a reuse of an unbound label as unknown", () => {
    const result = fillPattern("[color::a]", cols(["color", ["red"]]));
    expect(result.entry).toBe("[color::a]");
    expect(result.hasUnknown).toBe(true);
  });
});

describe("fillPattern — optionals", () => {
  it("emits optional content when the roll falls below the probability", () => {
    const result = fillPattern("a{b|0.5}c", [], sequentialRng([]), {
      random: scriptedRandom([0.4]),
    });
    expect(result.entry).toBe("abc");
  });

  it("omits optional content when the roll is at or above the probability", () => {
    const result = fillPattern("a{b|0.5}c", [], sequentialRng([]), {
      random: scriptedRandom([0.6]),
    });
    expect(result.entry).toBe("ac");
  });

  it("makes bindings inside a fired optional visible to later references", () => {
    const result = fillPattern(
      "{[color:a]|0.5} [color::a]",
      cols(["color", ["red", "green"]]),
      sequentialRng([1]),
      { random: scriptedRandom([0.1]) },
    );
    expect(result.entry).toBe("green green");
    expect(result.hasUnknown).toBe(false);
  });

  it("leaves a reuse unbound when its binding optional did not fire", () => {
    const result = fillPattern(
      "{[color:a]|0.5} [color::a]",
      cols(["color", ["red", "green"]]),
      sequentialRng([1]),
      { random: scriptedRandom([0.9]) },
    );
    expect(result.entry).toBe(" [color::a]");
    expect(result.hasUnknown).toBe(true);
  });
});

describe("fillPattern — segment integrity", () => {
  it("produces segments whose concatenation equals the entry", () => {
    const result = fillPattern(
      "There are [color:a], and [color::!a] dogs.",
      cols(["color", ["red", "green"]]),
      sequentialRng([0, 0]),
    );
    expect(result.segments.map((s) => s.text).join("")).toBe(result.entry);
  });
});

describe("referencedColumnNames", () => {
  it("returns distinct names in first-seen order, case-insensitive", () => {
    expect(referencedColumnNames("[a] [B] [a] [b] [c]")).toEqual([
      "a",
      "B",
      "c",
    ]);
  });

  it("descends into optionals and labeled/reuse references", () => {
    expect(referencedColumnNames("{[hero:h]|0.3} [villain] [hero::h]")).toEqual(
      ["hero", "villain"],
    );
  });
});
