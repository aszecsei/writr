import { describe, expect, it } from "vitest";
import { SCENE_BREAK_RE, splitParagraphs } from "./helpers";

describe("SCENE_BREAK_RE", () => {
  it("matches markdown-style thematic breaks", () => {
    for (const line of ["---", "----", "***", "___", "* * *", "- - -"]) {
      expect(SCENE_BREAK_RE.test(line)).toBe(true);
    }
  });

  it("matches a Writr scene-break marker", () => {
    expect(
      SCENE_BREAK_RE.test(
        '<hr data-type="sceneBreak" data-scene-id="abc-123">',
      ),
    ).toBe(true);
  });

  it("matches a bare <hr>", () => {
    expect(SCENE_BREAK_RE.test("<hr>")).toBe(true);
  });

  it("tolerates surrounding whitespace", () => {
    expect(SCENE_BREAK_RE.test("  ---  ")).toBe(true);
    expect(
      SCENE_BREAK_RE.test('  <hr data-type="sceneBreak" data-scene-id="x">  '),
    ).toBe(true);
  });

  it("does not match prose or partial breaks", () => {
    for (const line of ["--", "**", "hello world", "a---b", "the end."]) {
      expect(SCENE_BREAK_RE.test(line)).toBe(false);
    }
  });

  it("finds both break styles among split paragraphs", () => {
    const content = [
      "Opening scene.",
      "---",
      "Second scene.",
      '<hr data-type="sceneBreak" data-scene-id="s3">',
      "Third scene.",
    ].join("\n\n");
    const breaks = splitParagraphs(content).filter((p) =>
      SCENE_BREAK_RE.test(p),
    );
    expect(breaks).toHaveLength(2);
  });
});
