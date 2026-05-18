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

/**
 * Cheap, deterministic 32-bit FNV-1a hash for keying the in-session
 * audio cache. Not cryptographic — only needs to detect content change
 * to invalidate cached audio.
 */
export function hashTtsText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
