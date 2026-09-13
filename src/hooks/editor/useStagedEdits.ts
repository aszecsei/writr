import type { Editor } from "@tiptap/react";
import { useEffect, useRef } from "react";
import type { ChapterId } from "@/db/schemas";
import {
  locateProposedEdit,
  spliceEdit,
} from "@/lib/ai/tool-calling/tools/edit-locator";
import { replaceEditorContent } from "@/lib/editor/replace-content";
import { getMarkdown } from "@/lib/editor/tiptap-storage";
import { serializeFountain } from "@/lib/fountain";
import { useEditorStore } from "@/store/editorStore";

export interface UseStagedEditsOptions {
  editor: Editor | null;
  chapterId: ChapterId;
  isScreenplay: boolean;
  /** ChapterEditor's `save`: serializes the editor and persists everything derived from it. */
  saveChapter: () => Promise<void>;
  /** Re-anchor comments against the replaced document. */
  resetReconcile: () => void;
}

/**
 * AI-driven staged edits: the AiPanel posts an edit when the user clicks
 * Apply on a propose_edit diff card. The panel has no editor access, so we
 * resolve and apply here.
 *
 * Resolution runs against the chapter's serialized STRING (the same
 * representation propose_edit validated its anchor against) via the shared
 * `locateProposedEdit`. The spliced string is put straight into the live
 * editor — synchronously, so the user sees it at once and, when hosting a
 * collab session, the Collaboration extension carries it into the Y.Doc —
 * and then persisted through the editor's normal `save` (content, scene rows,
 * comment positions). The request stays pending until that save settles so
 * other cards can't interleave with a half-applied edit. The originating
 * card observes the outcome via `stagedEditResults`.
 */
export function useStagedEdits({
  editor,
  chapterId,
  isScreenplay,
  saveChapter,
  resetReconcile,
}: UseStagedEditsOptions) {
  const pendingStagedEdit = useEditorStore((s) => s.pendingStagedEdit);
  // The editId whose apply is in flight; guards against effect re-runs (e.g.
  // a new saveChapter identity) while the request is still pending.
  const inFlightRef = useRef<string | null>(null);

  useEffect(() => {
    // Editor not ready yet: wait — the effect re-runs when useEditor yields.
    if (!pendingStagedEdit || !editor || editor.isDestroyed) return;
    const edit = pendingStagedEdit;
    const {
      clearPendingStagedEdit,
      reportStagedEditResult,
      markSaving,
      markSaved,
      markSaveError,
      markDirty,
      setWordCount,
    } = useEditorStore.getState();

    if (edit.chapterId !== chapterId) {
      // The user navigated away between clicking Apply and this effect.
      reportStagedEditResult(edit.editId, "failed");
      clearPendingStagedEdit();
      return;
    }
    if (inFlightRef.current === edit.editId) return;

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

    inFlightRef.current = edit.editId;
    const next = spliceEdit(content, range, edit.newContent);
    setWordCount(replaceEditorContent(editor, next, { isScreenplay }));
    resetReconcile();
    markSaving();
    void (async () => {
      try {
        await saveChapter();
        markSaved();
      } catch (err) {
        // The edit is in the document; the autosave / unmount flush will
        // retry the write. Surface it through the save-status indicator.
        console.error("[propose_edit] persist failed:", err);
        markDirty();
        markSaveError();
      } finally {
        inFlightRef.current = null;
        reportStagedEditResult(edit.editId, "applied");
        clearPendingStagedEdit();
      }
    })();
  }, [
    pendingStagedEdit,
    editor,
    chapterId,
    isScreenplay,
    saveChapter,
    resetReconcile,
  ]);

  // If this editor unmounts with a request it never started, fail it so the
  // card doesn't sit on "Applying…" (and block every other card) forever.
  useEffect(() => {
    return () => {
      const {
        pendingStagedEdit: pending,
        reportStagedEditResult,
        clearPendingStagedEdit,
      } = useEditorStore.getState();
      if (pending && inFlightRef.current !== pending.editId) {
        reportStagedEditResult(pending.editId, "failed");
        clearPendingStagedEdit();
      }
    };
  }, []);
}
