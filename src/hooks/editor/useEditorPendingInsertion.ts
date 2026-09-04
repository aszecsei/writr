import type { Editor } from "@tiptap/react";
import { useEffect } from "react";
import type { useEditorStore } from "@/store/editorStore";

type PendingInsertion = ReturnType<
  typeof useEditorStore.getState
>["pendingInsertion"];

// Convert a markdown string into TipTap-compatible insertion content. Used
// by both the requestInsertAtCursor path (Spark inserts) and the
// requestStagedEdit path (propose_edit applies).
//
// Single-paragraph input returns inline text nodes so the splice stays
// inside the surrounding paragraph — wrapping inline content in a block
// paragraph splits the host paragraph in two, producing phantom \n\n on
// each side when the chapter round-trips to markdown. Multi-paragraph
// input returns block paragraph nodes; the splice deliberately splits the
// host paragraph, which is the intended outcome for multi-paragraph
// replacements. Inline marks (**bold** / *italic*) are not preserved — the
// LLM-generated inserts in practice are plain prose.
function markdownToInsertContent(markdown: string) {
  const paragraphs = markdown
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (paragraphs.length <= 1) {
    return paragraphs.map((text) => ({ type: "text", text }));
  }
  return paragraphs.map((text) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  }));
}

export interface UseEditorPendingInsertionOptions {
  editor: Editor | null;
  pendingInsertion: PendingInsertion | null;
  clearPendingInsertion: () => void;
}

/**
 * AI-driven inserts: the AiPanel posts markdown via editorStore. Apply at
 * the requested range (selection-replace) or current cursor, then clear.
 */
export function useEditorPendingInsertion({
  editor,
  pendingInsertion,
  clearPendingInsertion,
}: UseEditorPendingInsertionOptions) {
  useEffect(() => {
    if (!pendingInsertion || !editor || editor.isDestroyed) return;
    const { markdown, replaceRange } = pendingInsertion;
    const nodes = markdownToInsertContent(markdown);

    const chain = editor.chain().focus();
    if (replaceRange) {
      chain.insertContentAt(
        { from: replaceRange.from, to: replaceRange.to },
        nodes,
      );
    } else {
      const { from } = editor.state.selection;
      chain.insertContentAt(from, nodes);
    }
    chain.run();
    clearPendingInsertion();
  }, [pendingInsertion, editor, clearPendingInsertion]);
}
