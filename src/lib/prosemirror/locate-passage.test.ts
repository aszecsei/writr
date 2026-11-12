import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { DEFAULT_HOLE_DELIMITERS } from "@/lib/holes";
import { tokenizeText } from "@/lib/text-analysis/repeats/tokenize";
import { doc, heading, p, text } from "@/test/pm-schema";
import { locatePassageInDoc } from "./locate-passage";

function anchor(passage: string, occurrence = 0) {
  return { tokens: tokenizeText(passage).map((t) => t.word), occurrence };
}

function selected(
  d: ProseMirrorNode,
  range: { from: number; to: number } | null,
) {
  if (!range) return null;
  return d.textBetween(range.from, range.to, "\n");
}

const PASSAGE = "the gale came howling across the bay";

describe("locatePassageInDoc", () => {
  it("finds a passage whose text is split by an italic mark", () => {
    const d = doc(
      p(
        text("Then "),
        text("the gale came", ["em"]),
        text(" howling across the bay."),
      ),
    );
    expect(
      selected(
        d,
        locatePassageInDoc(d, anchor(PASSAGE), DEFAULT_HOLE_DELIMITERS),
      ),
    ).toBe("the gale came howling across the bay");
  });

  it("selects the requested occurrence of identical passages", () => {
    const d = doc(
      p(text(`${PASSAGE}.`)),
      p(text("Later, ")),
      p(text(`${PASSAGE}!`)),
    );
    const range = locatePassageInDoc(
      d,
      anchor(PASSAGE, 1),
      DEFAULT_HOLE_DELIMITERS,
    );
    expect(range?.from).toBeGreaterThan(d.child(0).nodeSize);
  });

  it("clamps an out-of-range occurrence to the last match", () => {
    const d = doc(p(text(PASSAGE)), p(text(PASSAGE)));
    const last = locatePassageInDoc(
      d,
      anchor(PASSAGE, 1),
      DEFAULT_HOLE_DELIMITERS,
    );
    expect(
      locatePassageInDoc(d, anchor(PASSAGE, 5), DEFAULT_HOLE_DELIMITERS),
    ).toEqual(last);
  });

  it("spans a passage across two paragraphs", () => {
    const d = doc(p(text("the gale came")), p(text("howling across the bay")));
    expect(
      selected(
        d,
        locatePassageInDoc(d, anchor(PASSAGE), DEFAULT_HOLE_DELIMITERS),
      ),
    ).toBe("the gale came\nhowling across the bay");
  });

  it("doesn't count heading text as an occurrence", () => {
    const d = doc(heading(text(PASSAGE)), p(text(PASSAGE)));
    const range = locatePassageInDoc(
      d,
      anchor(PASSAGE, 0),
      DEFAULT_HOLE_DELIMITERS,
    );
    expect(range?.from).toBeGreaterThan(d.child(0).nodeSize);
  });

  it("ignores hole content inside the passage", () => {
    const d = doc(p(text("the gale came [fix this] howling across the bay")));
    expect(
      locatePassageInDoc(d, anchor(PASSAGE), DEFAULT_HOLE_DELIMITERS),
    ).not.toBeNull();
  });

  it("matches regardless of curly or straight apostrophes", () => {
    const d = doc(p(text("the keeper’s lamp never dimmed")));
    expect(
      locatePassageInDoc(
        d,
        anchor("the keeper's lamp never dimmed"),
        DEFAULT_HOLE_DELIMITERS,
      ),
    ).not.toBeNull();
  });

  it("falls back to the opening words when the passage's tail was edited", () => {
    const original =
      "the salt stained windows of the old lighthouse rattled whenever the gale came";
    const d = doc(
      p(
        text(
          "the salt stained windows of the old lighthouse shook as the storm arrived",
        ),
      ),
    );
    expect(
      selected(
        d,
        locatePassageInDoc(d, anchor(original), DEFAULT_HOLE_DELIMITERS),
      ),
    ).toBe("the salt stained windows of the old lighthouse");
  });

  it("returns null when the passage is gone", () => {
    const d = doc(p(text("Nothing like it here.")));
    expect(
      locatePassageInDoc(d, anchor(PASSAGE), DEFAULT_HOLE_DELIMITERS),
    ).toBeNull();
  });
});
