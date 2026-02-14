import { describe, expect, it } from "vitest";
import { parseFountain } from "./parse";

describe("parseFountain", () => {
  it("parses scene headings", () => {
    const elements = parseFountain("INT. OFFICE - DAY\n\nSome action.");
    expect(elements[0]).toEqual({
      type: "scene_heading",
      text: "INT. OFFICE - DAY",
    });
  });

  it("parses scene headings with scene numbers", () => {
    const elements = parseFountain("INT. OFFICE - DAY #1#\n\nAction.");
    expect(elements[0]).toMatchObject({
      type: "scene_heading",
      text: "INT. OFFICE - DAY",
      sceneNumber: "1",
    });
  });

  it("parses action", () => {
    const elements = parseFountain(
      "INT. OFFICE - DAY\n\nJOHN walks to the desk.",
    );
    expect(elements[1]).toEqual({
      type: "action",
      text: "JOHN walks to the desk.",
    });
  });

  it("parses character and dialogue", () => {
    const elements = parseFountain("JOHN\nHello there.");
    const character = elements.find((e) => e.type === "character");
    const dialogue = elements.find((e) => e.type === "dialogue");
    expect(character?.text).toBe("JOHN");
    expect(dialogue?.text).toBe("Hello there.");
  });

  it("parses parentheticals", () => {
    const elements = parseFountain("JOHN\n(whispering)\nHello there.");
    const paren = elements.find((e) => e.type === "parenthetical");
    expect(paren?.text).toBe("(whispering)");
  });

  it("parses transitions", () => {
    const elements = parseFountain(
      "INT. OFFICE - DAY\n\nSome action.\n\nCUT TO:\n",
    );
    const transition = elements.find((e) => e.type === "transition");
    expect(transition?.text).toBe("CUT TO:");
  });

  it("parses centered text", () => {
    const elements = parseFountain("> THE END <");
    const centered = elements.find((e) => e.type === "centered");
    expect(centered?.text).toBe("THE END");
  });

  it("parses page breaks", () => {
    const elements = parseFountain(
      "INT. OFFICE - DAY\n\nAction.\n\n===\n\nINT. LOBBY - NIGHT\n\nMore action.",
    );
    const pageBreak = elements.find((e) => e.type === "page_break");
    expect(pageBreak).toBeDefined();
    expect(pageBreak?.text).toBe("");
  });

  it("strips dialogue_begin/end wrapper tokens", () => {
    const elements = parseFountain("JOHN\nHello.");
    const types = elements.map((e) => e.type);
    expect(types).not.toContain("dialogue_begin");
    expect(types).not.toContain("dialogue_end");
  });

  it("returns empty array for empty input", () => {
    expect(parseFountain("")).toEqual([]);
  });
});
