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

describe("SceneBreak markdown round-trip", () => {
  it("preserves the sceneId through a markdown save/load cycle", () => {
    const md = withEditor(createExtensions(), (editor) => {
      editor.commands.setContent(
        "<p>Before the break.</p><p>After the break.</p>",
      );
      // Insert the break at the end of the first paragraph (position 18). A
      // scene-break atom is selectable, so after insertion the selection lands
      // on it — real callers must reposition before inserting anything else.
      editor.commands.setTextSelection(18);
      editor.commands.insertSceneBreak("scene-abc");
      return getMarkdown(editor);
    });

    // The serialized marker carries the id...
    expect(md).toContain('data-type="sceneBreak"');
    expect(md).toContain('data-scene-id="scene-abc"');

    // ...and re-parsing the markdown reconstructs exactly one sceneBreak node
    // with that id (not a plain horizontal rule).
    const roundTripped = withEditor(createExtensions(), (editor) => {
      editor.commands.setContent(md);
      const ids: (string | null)[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === "sceneBreak") {
          ids.push(node.attrs.sceneId as string | null);
        }
      });
      return ids;
    });

    expect(roundTripped).toEqual(["scene-abc"]);
  });
});
