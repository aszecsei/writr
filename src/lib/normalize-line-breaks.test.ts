import { describe, expect, it } from "vitest";
import { doc, hardBreak, heading, p, text } from "@/test/pm-schema";
import { findLineBreakPairs } from "./normalize-line-breaks";

describe("findLineBreakPairs", () => {
  it("finds a single pair between text", () => {
    // <p>A<br><br>B</p>
    // positions: A=1, br=2, br=3, B=4
    const d = doc(p(text("A"), hardBreak(), hardBreak(), text("B")));
    const pairs = findLineBreakPairs(d);

    expect(pairs).toEqual([{ from: 2, to: 4 }]);
  });

  it("leaves a leftover hardBreak when run length is odd", () => {
    // <p>A<br><br><br>B</p>
    const d = doc(
      p(text("A"), hardBreak(), hardBreak(), hardBreak(), text("B")),
    );
    const pairs = findLineBreakPairs(d);

    // Only the first two are paired; the third is leftover.
    expect(pairs).toEqual([{ from: 2, to: 4 }]);
  });

  it("emits non-overlapping pairs for a run of four", () => {
    // <p>A<br><br><br><br>B</p>
    const d = doc(
      p(
        text("A"),
        hardBreak(),
        hardBreak(),
        hardBreak(),
        hardBreak(),
        text("B"),
      ),
    );
    const pairs = findLineBreakPairs(d);

    expect(pairs).toEqual([
      { from: 2, to: 4 },
      { from: 4, to: 6 },
    ]);
  });

  it("handles a pair at the start of a paragraph", () => {
    // <p><br><br>A</p>
    const d = doc(p(hardBreak(), hardBreak(), text("A")));
    const pairs = findLineBreakPairs(d);

    expect(pairs).toEqual([{ from: 1, to: 3 }]);
  });

  it("handles a pair at the end of a paragraph", () => {
    // <p>A<br><br></p>
    const d = doc(p(text("A"), hardBreak(), hardBreak()));
    const pairs = findLineBreakPairs(d);

    expect(pairs).toEqual([{ from: 2, to: 4 }]);
  });

  it("ignores a single non-adjacent hardBreak", () => {
    // <p>A<br>B</p>
    const d = doc(p(text("A"), hardBreak(), text("B")));
    const pairs = findLineBreakPairs(d);

    expect(pairs).toEqual([]);
  });

  it("ignores non-adjacent breaks separated by text", () => {
    // <p><br>text<br></p>
    const d = doc(p(hardBreak(), text("text"), hardBreak()));
    const pairs = findLineBreakPairs(d);

    expect(pairs).toEqual([]);
  });

  it("finds pairs across multiple paragraphs", () => {
    // <p>A<br><br>B</p><p>C<br><br>D</p>
    const d = doc(
      p(text("A"), hardBreak(), hardBreak(), text("B")),
      p(text("C"), hardBreak(), hardBreak(), text("D")),
    );
    const pairs = findLineBreakPairs(d);

    // First paragraph spans positions 0..6, second starts at pos 6.
    // Inside second paragraph: C=7, br=8, br=9, D=10 → pair { from: 8, to: 10 }.
    expect(pairs).toEqual([
      { from: 2, to: 4 },
      { from: 8, to: 10 },
    ]);
  });

  it("skips hardBreaks inside headings", () => {
    const d = doc(heading(text("A"), hardBreak(), hardBreak(), text("B")));
    const pairs = findLineBreakPairs(d);

    expect(pairs).toEqual([]);
  });

  it("returns empty for empty paragraph", () => {
    const d = doc(p());
    const pairs = findLineBreakPairs(d);

    expect(pairs).toEqual([]);
  });

  it("returns empty for paragraph with text but no breaks", () => {
    const d = doc(p(text("Hello world")));
    const pairs = findLineBreakPairs(d);

    expect(pairs).toEqual([]);
  });
});
