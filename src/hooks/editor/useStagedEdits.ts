import type { Editor } from "@tiptap/react";
import type { MutableRefObject } from "react";
import { useEffect } from "react";
import { updateChapterContent } from "@/db/operations";
import type { ChapterId } from "@/db/schemas";
import {
  locateProposedEdit,
  spliceEdit,
} from "@/lib/ai/tool-calling/tools/edit-locator";
import { getMarkdown } from "@/lib/editor/tiptap-storage";
import { serializeFountain } from "@/lib/fountain";
import { countWordsExcludingHoles, type HoleDelimiters } from "@/lib/holes";
import type { PendingStagedEdit } from "@/store/editorStore";

// Word count for a serialized chapter string (markdown or fountain). Used when
// persisting a staged-edit splice, where the editor's live characterCount isn't
// available for the post-splice content (it's reseeded asynchronously). The
// next real editor save recomputes the authoritative count. Holes are excluded
// to match the live CharacterCount, which is configured the same way.
function countContentWords(text: string, delimiters: HoleDelimiters): number {
  return countWordsExcludingHoles(text, delimiters);
}

export interface UseStagedEditsOptions {
  editor: Editor | null;
  chapterId: ChapterId;
  isScreenplay: boolean;
  pendingStagedEdit: PendingStagedEdit | null;
  clearPendingStagedEdit: () => void;
  reportStagedEditResult: (
    editId: string,
    result: "applied" | "failed",
  ) => void;
  markSaved: () => void;
  bumpContentVersion: () => void;
  holeDelimitersRef: MutableRefObject<HoleDelimiters>;
}

/**
 * AI-driven staged edits: the AiPanel posts an edit when the user clicks
 * Apply on a propose_edit diff card. The panel has no editor access, so we
 * resolve and apply here. Resolution runs against the chapter's serialized
 * STRING (the same representation propose_edit validated its anchor against)
 * via the shared `locateProposedEdit` — not the flattened PM doc, which
 * strips markdown and silently dropped any anchor touching formatting. We
 * splice the string, persist, then `bumpContentVersion` to reseed the editor
 * (re-parsing fountain when needed) and re-anchor comments through the normal
 * reconcile path. The originating card observes the outcome via
 * `reportStagedEditResult`.
 */
export function useStagedEdits({
  editor,
  chapterId,
  isScreenplay,
  pendingStagedEdit,
  clearPendingStagedEdit,
  reportStagedEditResult,
  markSaved,
  bumpContentVersion,
  holeDelimitersRef,
}: UseStagedEditsOptions) {
  useEffect(() => {
    if (!pendingStagedEdit || !editor || editor.isDestroyed) return;
    if (pendingStagedEdit.chapterId !== chapterId) return;
    const edit = pendingStagedEdit;

    const content = isScreenplay
      ? serializeFountain(editor.state.doc)
      : getMarkdown(editor.storage);
    const range = locateProposedEdit(content, edit);

    if (!range) {
      console.warn(
        `[propose_edit] anchorText not located in chapter — staged ${edit.kind} edit dropped`,
      );
      reportStagedEditResult(edit.editId, "failed");
      clearPendingStagedEdit();
      return;
    }

    const next = spliceEdit(content, range, edit.newContent);
    clearPendingStagedEdit();
    // Cancel any pending autosave before persisting. A debounced autosave armed
    // by recent typing would read the editor doc — which still holds the
    // pre-splice content until the async reseed below — and clobber our write.
    // Marking saved clears that timer; our apply never re-dirties the doc, so no
    // new autosave starts before the reseed.
    markSaved();
    void (async () => {
      await updateChapterContent(
        chapterId,
        next,
        countContentWords(next, holeDelimitersRef.current),
      );
      bumpContentVersion();
      reportStagedEditResult(edit.editId, "applied");
    })();
  }, [
    pendingStagedEdit,
    editor,
    chapterId,
    isScreenplay,
    reportStagedEditResult,
    clearPendingStagedEdit,
    markSaved,
    bumpContentVersion,
    holeDelimitersRef,
  ]);
}
