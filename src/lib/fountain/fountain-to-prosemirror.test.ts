import { describe, expect, it } from "vitest";
import { fountainToProseMirror } from "./fountain-to-prosemirror";
import type { FountainElement } from "./types";

describe("fountainToProseMirror", () => {
  it("converts scene heading", () => {
    const elements: FountainElement[] = [
      { type: "scene_heading", text: "INT. OFFICE - DAY" },
    ];
    const doc = fountainToProseMirror(elements);
    expect(doc.type).toBe("doc");
    expect(doc.content).toHaveLength(1);
    expect(doc.content?.[0].type).toBe("sceneHeading");
    expect(doc.content?.[0].content?.[0].text).toBe("INT. OFFICE - DAY");
  });

  it("preserves scene number attribute", () => {
    const elements: FountainElement[] = [
      { type: "scene_heading", text: "INT. OFFICE - DAY", sceneNumber: "1" },
    ];
    const doc = fountainToProseMirror(elements);
    expect(doc.content?.[0].attrs?.sceneNumber).toBe("1");
  });

  it("converts all element types", () => {
    const elements: FountainElement[] = [
      { type: "scene_heading", text: "INT. OFFICE - DAY" },
      { type: "action", text: "John enters." },
      { type: "character", text: "JOHN" },
      { type: "dialogue", text: "Hello." },
      { type: "parenthetical", text: "(quietly)" },
      { type: "transition", text: "CUT TO:" },
      { type: "centered", text: "THE END" },
      { type: "page_break", text: "" },
    ];

    const doc = fountainToProseMirror(elements);
    expect(doc.content).toHaveLength(8);

    const types = doc.content?.map((n) => n.type);
    expect(types).toEqual([
      "sceneHeading",
      "action",
      "character",
      "dialogue",
      "parenthetical",
      "transition",
      "centered",
      "screenplayPageBreak",
    ]);
  });

  it("handles inline bold formatting", () => {
    const elements: FountainElement[] = [
      { type: "action", text: "He **runs** away." },
    ];
    const doc = fountainToProseMirror(elements);
    const content = doc.content?.[0].content ?? [];
    expect(content).toHaveLength(3);
    expect(content[0].text).toBe("He ");
    expect(content[1].text).toBe("runs");
    expect(content[1].marks).toEqual([{ type: "bold" }]);
    expect(content[2].text).toBe(" away.");
  });

  it("returns empty action for empty input", () => {
    const doc = fountainToProseMirror([]);
    expect(doc.content).toHaveLength(1);
    expect(doc.content?.[0].type).toBe("action");
  });
});
