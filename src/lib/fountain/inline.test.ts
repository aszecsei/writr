import { describe, expect, it } from "vitest";
import {
  type FountainSpan,
  parseFountainInline,
  serializeFountainInline,
} from "./inline";

describe("parseFountainInline", () => {
  it.each([
    ["*x*", ["italic"]],
    ["**x**", ["bold"]],
    ["***x***", ["bold", "italic"]],
    ["_x_", ["underline"]],
    ["_**x**_", ["underline", "bold"]],
    ["**_x_**", ["underline", "bold"]],
    ["_*x*_", ["underline", "italic"]],
    ["_***x***_", ["underline", "bold", "italic"]],
  ])("reads %s", (text, marks) => {
    expect(parseFountainInline(text)).toEqual([{ text: "x", marks }]);
  });

  it("keeps plain text around emphasis", () => {
    expect(parseFountainInline("He **runs** away.")).toEqual([
      { text: "He ", marks: [] },
      { text: "runs", marks: ["bold"] },
      { text: " away.", marks: [] },
    ]);
  });

  it("toggles marks independently, so `**a*b***` is bold then bold-italic", () => {
    expect(parseFountainInline("**a*b***")).toEqual([
      { text: "a", marks: ["bold"] },
      { text: "b", marks: ["bold", "italic"] },
    ]);
  });

  it("reads escaped delimiters as literal characters", () => {
    expect(parseFountainInline("\\*not\\* \\_this\\_ a\\\\b")).toEqual([
      { text: "*not* _this_ a\\b", marks: [] },
    ]);
  });

  it("keeps an unmatched delimiter literal", () => {
    expect(parseFountainInline("2*3")).toEqual([{ text: "2*3", marks: [] }]);
    expect(parseFountainInline("snake_case")).toEqual([
      { text: "snake_case", marks: [] },
    ]);
  });

  it("keeps a trailing unmatched opener literal without losing the pair before it", () => {
    expect(parseFountainInline("*a* b*")).toEqual([
      { text: "a", marks: ["italic"] },
      { text: " b*", marks: [] },
    ]);
  });

  it("returns no spans for empty text", () => {
    expect(parseFountainInline("")).toEqual([]);
  });
});

describe("serializeFountainInline", () => {
  it("writes each mark with Fountain delimiters, underline outermost", () => {
    expect(
      serializeFountainInline([
        { text: "a", marks: ["italic"] },
        { text: " ", marks: [] },
        { text: "b", marks: ["bold"] },
        { text: " ", marks: [] },
        { text: "c", marks: ["underline", "bold", "italic"] },
      ]),
    ).toBe("*a* **b** _***c***_");
  });

  it("escapes literal delimiters", () => {
    expect(serializeFountainInline([{ text: "2*3_4\\", marks: [] }])).toBe(
      "2\\*3\\_4\\\\",
    );
  });

  it("moves edge whitespace outside the delimiters", () => {
    expect(
      serializeFountainInline([
        { text: "a", marks: [] },
        { text: " bold ", marks: ["bold"] },
        { text: "c", marks: [] },
      ]),
    ).toBe("a **bold** c");
  });

  it.each<[string, FountainSpan[]]>([
    ["single mark", [{ text: "x", marks: ["bold"] }]],
    [
      "adjacent mixed marks",
      [
        { text: "a", marks: ["bold"] },
        { text: "b", marks: ["bold", "italic"] },
        { text: "c", marks: ["italic"] },
      ],
    ],
    [
      "underline switching to bold",
      [
        { text: "a", marks: ["underline"] },
        { text: "b", marks: ["bold"] },
      ],
    ],
    [
      "every mark with literal delimiters",
      [
        { text: "x*y_z", marks: ["underline", "bold", "italic"] },
        { text: " and 2*3", marks: [] },
      ],
    ],
  ])("round-trips %s through parseFountainInline", (_name, spans) => {
    expect(parseFountainInline(serializeFountainInline(spans))).toEqual(spans);
  });
});
