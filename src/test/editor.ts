import { Editor, type Extensions } from "@tiptap/core";

/** Builds a TipTap editor with `extensions`, runs `fn`, and always destroys it. */
export function withEditor<T>(
  extensions: Extensions,
  fn: (editor: Editor) => T,
): T {
  const editor = new Editor({ extensions, content: "" });
  try {
    return fn(editor);
  } finally {
    editor.destroy();
  }
}
