// @vitest-environment jsdom
import type { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { withEditor } from "@/test/editor";
import { createExtensions } from "./index";

// tiptap-markdown stashes its serializer under editor.storage.markdown, which
// TipTap's Storage type doesn't know about (mirrors ChapterEditor.tsx).
function getMarkdown(editor: Editor): string {
  return (
    editor.storage as unknown as { markdown: { getMarkdown: () => string } }
  ).markdown.getMarkdown();
}

// Emphasis inside a multi-paragraph blockquote must round-trip through
// markdown (parse -> serialize) unchanged.
function roundTrip(markdown: string): string {
  return withEditor(createExtensions(), (editor) => {
    editor.commands.setContent(markdown);
    return getMarkdown(editor);
  });
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
    // Driven from a doc, not markdown: markdown-it does not re-nest a
    // list-indented blockquote on parse. Continuation lines must carry the
    // list's `  ` indent.
    const md = withEditor(createExtensions(), (editor) => {
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
      return getMarkdown(editor);
    });
    expect(md).toBe("- > *First line*\n  >\n  > *Second line*");
  });
});

function italicParagraph(text: string) {
  return {
    type: "paragraph",
    content: [{ type: "text", marks: [{ type: "italic" }], text }],
  };
}
