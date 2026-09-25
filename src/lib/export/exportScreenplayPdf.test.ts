import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportScreenplayPdf } from "./exportScreenplayPdf";
import { opts } from "./test-helpers";

let captured: TDocumentDefinitions | undefined;

vi.mock("./pdfmake", () => ({
  loadPdfMake: async () => ({
    createPdf: (doc: TDocumentDefinitions) => {
      captured = doc;
      return { getBlob: async () => new Blob() };
    },
  }),
}));

async function render(fountain: string) {
  await exportScreenplayPdf(
    {
      projectTitle: "Script",
      chapters: [{ title: "Seq", content: fountain, level: 0 }],
    },
    opts({ format: "pdf" }),
  );
  return captured?.content as { text: unknown }[];
}

describe("exportScreenplayPdf", () => {
  beforeEach(() => {
    captured = undefined;
  });

  it("renders bold, italic and underline in action", async () => {
    const [action] = await render("He **runs**, *fast*, _now_.");
    expect(action.text).toEqual([
      { text: "He " },
      { text: "runs", bold: true },
      { text: ", " },
      { text: "fast", italics: true },
      { text: ", " },
      { text: "now", decoration: "underline" },
      { text: "." },
    ]);
  });

  it("keeps emphasis on a character name and its dialogue", async () => {
    const [character, dialogue] = await render("**JOHN**\nI said ***no***.");
    expect(character.text).toEqual([{ text: "JOHN", bold: true }]);
    expect(dialogue.text).toEqual([
      { text: "I said " },
      { text: "no", bold: true, italics: true },
      { text: "." },
    ]);
  });

  it("leaves no emphasis delimiters in the output", async () => {
    const content = await render(
      "INT. OFFICE - DAY\n\n_***Everything***_ at *once*.\n\n> **THE END** <",
    );
    expect(JSON.stringify(content)).not.toMatch(/[*_]/);
  });
});
