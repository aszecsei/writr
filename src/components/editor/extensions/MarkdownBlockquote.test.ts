// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createExtensions } from "./index";

// tiptap-markdown stashes its serializer under editor.storage.markdown, which
// TipTap's Storage type doesn't know about (mirrors ChapterEditor.tsx).
function getMarkdown(editor: Editor): string {
  return (
    editor.storage as unknown as { markdown: { getMarkdown: () => string } }
  ).markdown.getMarkdown();
}

/**
 * These guard against a tiptap-markdown serializer bug where emphasis inside a
 * multi-paragraph blockquote round-trips into literal `*> ...` text. The doc is
 * driven entirely through markdown (parse -> serialize) so the assertions match
 * exactly what gets persisted to and reloaded from IndexedDB.
 */
function roundTrip(markdown: string): string {
  const editor = new Editor({ extensions: createExtensions(), content: "" });
  try {
    editor.commands.setContent(markdown);
    return getMarkdown(editor);
  } finally {
    editor.destroy();
  }
}

describe("MarkdownBlockquote serialization", () => {
  it("preserves italics across a multi-paragraph blockquote", () => {
    const md = "> *First line*\n>\n> *Second line*\n>\n> *Third line*";
    expect(roundTrip(md)).toBe(md);
  });

  it("preserves bold across a multi-paragraph blockquote", () => {
    const md = "> **First line**\n>\n> **Second line**";
    expect(roundTrip(md)).toBe(md);
  });

  it("leaves a single-paragraph italic blockquote untouched", () => {
    const md = "> *Only line*";
    expect(roundTrip(md)).toBe(md);
  });

  it("keeps the list indent on a blockquote nested in a bullet list", () => {
    // Driven from a doc (not markdown) because markdown-it does not re-nest a
    // list-indented blockquote on parse; this isolates the serializer, which is
    // what the fix changes. Continuation lines must carry the `  ` list indent.
    const editor = new Editor({ extensions: createExtensions(), content: "" });
    try {
      editor.commands.setContent({
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "blockquote",
                    content: [
                      italicParagraph("First line"),
                      italicParagraph("Second line"),
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
      expect(getMarkdown(editor)).toBe(
        "- > *First line*\n  >\n  > *Second line*",
      );
    } finally {
      editor.destroy();
    }
  });
});

function italicParagraph(text: string) {
  return {
    type: "paragraph",
    content: [{ type: "text", marks: [{ type: "italic" }], text }],
  };
}
