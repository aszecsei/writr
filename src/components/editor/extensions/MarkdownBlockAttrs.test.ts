// @vitest-environment jsdom
import type { Editor, JSONContent } from "@tiptap/core";
import type { MarkdownStorage } from "tiptap-markdown";
import { describe, expect, it } from "vitest";
import { withEditor } from "@/test/editor";
import { createExtensions } from "./index";

// tiptap-markdown stashes its serializer under editor.storage.markdown, which
// TipTap's (augmentable, but not augmented) Storage type doesn't declare.
function getMarkdown(editor: Editor): string {
  const { markdown } = editor.storage as { markdown?: MarkdownStorage };
  if (!markdown) throw new Error("Markdown extension not registered");
  return markdown.getMarkdown();
}

/** Serializes `doc` to markdown, then parses that markdown back into a doc. */
function roundTrip(doc: JSONContent): { markdown: string; doc: JSONContent } {
  return withEditor(createExtensions(), (editor) => {
    editor.commands.setContent(doc);
    const markdown = getMarkdown(editor);
    editor.commands.setContent(markdown);
    return { markdown, doc: editor.getJSON() };
  });
}

function paragraph(
  text: string,
  attrs: Record<string, unknown> = {},
  marks?: JSONContent["marks"],
): JSONContent {
  return { type: "paragraph", attrs, content: [{ type: "text", text, marks }] };
}

describe("MarkdownParagraph / MarkdownHeading serialization", () => {
  it("replaces StarterKit's paragraph and heading rather than duplicating them", () => {
    const names = withEditor(createExtensions(), (editor) =>
      editor.extensionManager.extensions.map((ext) => ext.name),
    );
    expect(names.filter((n) => n === "paragraph")).toHaveLength(1);
    expect(names.filter((n) => n === "heading")).toHaveLength(1);
  });

  it("round-trips a centered paragraph as an HTML block", () => {
    const { markdown, doc } = roundTrip({
      type: "doc",
      content: [paragraph("Centered", { textAlign: "center" })],
    });
    expect(markdown).toMatch(
      /^<p style="text-align: center;?">\nCentered\n<\/p>$/,
    );
    expect(doc.content?.[0]).toMatchObject({
      type: "paragraph",
      attrs: { textAlign: "center" },
      content: [{ type: "text", text: "Centered" }],
    });
  });

  it("keeps a right-aligned heading's level and alignment", () => {
    const { doc } = roundTrip({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2, textAlign: "right" },
          content: [{ type: "text", text: "Title" }],
        },
      ],
    });
    expect(doc.content?.[0]).toMatchObject({
      type: "heading",
      attrs: { level: 2, textAlign: "right" },
    });
  });

  it("keeps both alignment and indent on a justified, indented paragraph", () => {
    const { doc } = roundTrip({
      type: "doc",
      content: [paragraph("Body", { textAlign: "justify", indent: 2 })],
    });
    expect(doc.content?.[0]).toMatchObject({
      attrs: { textAlign: "justify", indent: 2 },
    });
  });

  it("keeps an indent-only paragraph's indent", () => {
    const { doc } = roundTrip({
      type: "doc",
      content: [paragraph("Body", { indent: 1 })],
    });
    expect(doc.content?.[0]).toMatchObject({
      attrs: { textAlign: "left", indent: 1 },
    });
  });

  it("preserves inline marks inside an aligned paragraph", () => {
    const { doc } = roundTrip({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "center" },
          content: [
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: " and " },
            { type: "text", text: "italic", marks: [{ type: "italic" }] },
          ],
        },
      ],
    });
    expect(doc.content?.[0].content).toEqual([
      { type: "text", text: "bold", marks: [{ type: "bold" }] },
      { type: "text", text: " and " },
      { type: "text", text: "italic", marks: [{ type: "italic" }] },
    ]);
  });

  it("writes left-aligned, unindented blocks as plain markdown", () => {
    const { markdown } = roundTrip({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1, textAlign: "left" },
          content: [{ type: "text", text: "Title" }],
        },
        paragraph("Plain", { textAlign: "left" }),
      ],
    });
    expect(markdown).toBe("# Title\n\nPlain");
  });

  it("does not swallow the plain paragraphs around an aligned one", () => {
    const { doc } = roundTrip({
      type: "doc",
      content: [
        paragraph("Before"),
        paragraph("Middle", { textAlign: "center" }),
        paragraph("After"),
      ],
    });
    expect(
      doc.content?.map((n) => [n.content?.[0].text, n.attrs?.textAlign]),
    ).toEqual([
      ["Before", "left"],
      ["Middle", "center"],
      ["After", "left"],
    ]);
  });
});
