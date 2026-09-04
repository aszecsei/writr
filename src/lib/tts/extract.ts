import type { Editor } from "@tiptap/react";

/**
 * Plain-text extractor for "Read Aloud". If the user has a non-empty
 * selection, read just that range; otherwise read the full chapter.
 *
 * Uses ProseMirror's `textBetween` with `\n` as the block separator,
 * matching how the rest of Writr extracts plain text for AI / export
 * pipelines.
 */
export function extractReadAloudText(editor: Editor): string {
  const { from, to, empty } = editor.state.selection;
  if (!empty) {
    return editor.state.doc.textBetween(from, to, "\n");
  }
  const doc = editor.state.doc;
  return doc.textBetween(0, doc.content.size, "\n");
}
