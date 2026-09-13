import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { COMMENTS_RESET_META } from "@/components/editor/extensions/Comments";
import { getWordCount } from "@/lib/editor/tiptap-storage";
import { fountainToProseMirror, parseFountain } from "@/lib/fountain";

/**
 * Replace the whole document with a serialized chapter string (markdown for
 * prose, fountain for screenplay). Shared by the initial seed, version-bump
 * reseeds, and staged-edit applies, so every whole-document replacement
 * behaves the same way:
 *
 * - Runs as one transaction with `emitUpdate: false` — a seed or an AI apply
 *   is not a user edit and must not mark the document dirty.
 * - Carries `COMMENTS_RESET_META` so the Comments plugin drops its tracked
 *   positions (mapping them through a full replace collapses every comment
 *   to the document end) and falls back to stored offsets until the next
 *   reconcile lands.
 * - Restores the caret near where it was instead of letting it jump to the
 *   end of the new document.
 *
 * Returns the new word count from the editor's CharacterCount storage.
 */
export function replaceEditorContent(
  editor: Editor,
  content: string,
  options: { isScreenplay: boolean },
): number {
  const caret = editor.state.selection.from;
  const next = options.isScreenplay
    ? fountainToProseMirror(parseFountain(content))
    : content;

  editor
    .chain()
    .setContent(next, { emitUpdate: false })
    .setMeta(COMMENTS_RESET_META, true)
    .run();

  const size = editor.state.doc.content.size;
  const pos = Math.max(1, Math.min(caret, Math.max(1, size - 1)));
  const tr = editor.state.tr;
  tr.setSelection(TextSelection.near(tr.doc.resolve(pos)));
  editor.view.dispatch(tr);

  return getWordCount(editor.storage);
}
