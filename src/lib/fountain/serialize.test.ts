import { getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createScreenplayExtensions } from "@/components/editor/extensions";
import { fountainToProseMirror } from "./fountain-to-prosemirror";
import { parseFountain } from "./parse";
import { serializeFountain } from "./serialize";

const schema = getSchema(createScreenplayExtensions());

function docFromJSON(content: unknown[]) {
  return schema.nodeFromJSON({ type: "doc", content });
}

function text(value: string, ...marks: string[]) {
  return marks.length === 0
    ? { type: "text", text: value }
    : { type: "text", text: value, marks: marks.map((type) => ({ type })) };
}

describe("serializeFountain", () => {
  it("writes bold, italic and underline marks as Fountain emphasis", () => {
    const doc = docFromJSON([
      {
        type: "action",
        content: [
          text("He "),
          text("runs", "bold"),
          text(", "),
          text("fast", "italic"),
          text(", "),
          text("now", "underline"),
          text("."),
        ],
      },
    ]);
    expect(serializeFountain(doc)).toBe("He **runs**, *fast*, _now_.");
  });

  it("uppercases a character name without losing its emphasis", () => {
    const doc = docFromJSON([
      { type: "character", content: [text("john", "bold")] },
      { type: "dialogue", content: [text("Hi.")] },
    ]);
    expect(serializeFountain(doc)).toBe("**JOHN**\nHi.");
  });

  it("round-trips marks through parseFountain and fountainToProseMirror", () => {
    const doc = docFromJSON([
      { type: "sceneHeading", content: [text("INT. OFFICE - DAY")] },
      {
        type: "action",
        content: [text("A "), text("loud", "bold", "italic"), text(" bang.")],
      },
      { type: "character", content: [text("JOHN")] },
      { type: "parenthetical", content: [text("(quietly)", "italic")] },
      {
        type: "dialogue",
        content: [text("I said "), text("no", "underline", "bold"), text(".")],
      },
      { type: "transition", content: [text("CUT TO:")] },
    ]);
    const reloaded = schema.nodeFromJSON(
      fountainToProseMirror(parseFountain(serializeFountain(doc))),
    );
    expect(reloaded.toJSON()).toEqual(doc.toJSON());
  });
});
