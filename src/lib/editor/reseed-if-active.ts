import type { ChapterId } from "@/db/schemas";
import { selectActiveChapterId, useEditorStore } from "@/store/editorStore";

/**
 * Reseed the open editor from Dexie when one of `chapterIds` is the active
 * chapter. Call after writing a chapter's content outside the editor.
 */
export function reseedIfActive(...chapterIds: ChapterId[]): void {
  const state = useEditorStore.getState();
  const active = selectActiveChapterId(state);
  if (active && chapterIds.includes(active)) {
    // Cancel a pending autosave (it holds pre-op editor content), then bump the
    // content version so ChapterEditor re-seeds from the freshly written row.
    state.markSaved();
    state.bumpContentVersion();
  }
}
