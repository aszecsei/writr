import { describe, expect, it } from "vitest";
import type { ChapterId } from "@/db/schemas";
import { DEFAULT_HOLE_DELIMITERS } from "@/lib/holes";
import { makeRepeatRunKey } from "./run-key";

const a = { id: "a" as ChapterId, content: "First chapter." };
const b = { id: "b" as ChapterId, content: "Second chapter." };

describe("makeRepeatRunKey", () => {
  const base = makeRepeatRunKey([a, b], "prose", DEFAULT_HOLE_DELIMITERS);

  it("changes when a chapter's text changes", () => {
    const edited = { ...b, content: "Second chapter, revised." };
    expect(
      makeRepeatRunKey([a, edited], "prose", DEFAULT_HOLE_DELIMITERS),
    ).not.toBe(base);
  });

  it("ignores re-saves that leave the text unchanged", () => {
    const resaved = { ...b, updatedAt: "2099-01-01T00:00:00.000Z" };
    expect(
      makeRepeatRunKey([a, resaved], "prose", DEFAULT_HOLE_DELIMITERS),
    ).toBe(base);
  });

  it("changes when chapters are reordered", () => {
    expect(makeRepeatRunKey([b, a], "prose", DEFAULT_HOLE_DELIMITERS)).not.toBe(
      base,
    );
  });

  it("changes when the hole delimiters change", () => {
    expect(
      makeRepeatRunKey([a, b], "prose", { open: "{{", close: "}}" }),
    ).not.toBe(base);
  });
});
