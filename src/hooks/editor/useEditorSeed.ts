import type { Editor } from "@tiptap/react";
import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";
import type * as Y from "yjs";
import { getChapter } from "@/db/operations/chapters";
import type { ChapterId, SceneId } from "@/db/schemas";
import { replaceEditorContent } from "@/lib/editor/replace-content";
import { scrollToPos } from "@/lib/editor/scroll";

/** Position of the sceneBreak marker carrying `sceneId`, or null if absent. */
function findSceneMarkerPos(editor: Editor, sceneId: string): number | null {
  let pos: number | null = null;
  editor.state.doc.forEach((node, offset) => {
    if (
      pos === null &&
      node.type.name === "sceneBreak" &&
      node.attrs.sceneId === sceneId
    ) {
      pos = offset;
    }
  });
  return pos;
}

/**
 * Scroll the editor to a scene and place the caret at its start. Returns false
 * (a no-op) when the scene doesn't belong to this chapter's loaded rows — the
 * caller then leaves the scroll request pending for the right chapter's editor.
 * The core scene (no marker) scrolls to the top.
 *
 * Scrolls via `scrollToPos` (not ProseMirror's transaction-level
 * scrollIntoView, which doesn't reliably walk the editor's nested overflow
 * containers), deferred a frame so it runs against post-seed layout.
 */
function scrollEditorToScene(
  editor: Editor,
  scenes: { id: string }[],
  targetId: string,
): boolean {
  if (!scenes.some((s) => s.id === targetId)) return false;
  const markerPos = findSceneMarkerPos(editor, targetId);
  const size = editor.state.doc.content.size;
  const caret = markerPos !== null ? markerPos + 1 : 1;
  // Move the caret to the scene start (drives the active-scene highlight).
  editor
    .chain()
    .setTextSelection(Math.max(1, Math.min(caret, size)))
    .run();
  requestAnimationFrame(() => {
    if (editor.isDestroyed) return;
    scrollToPos(editor, markerPos ?? 1, { center: true });
  });
  return true;
}

export interface UseEditorSeedOptions {
  editor: Editor | null;
  chapterId: ChapterId;
  isScreenplay: boolean;
  collabDoc: Y.Doc | null;
  isCollabHost: boolean;
  contentVersion: number;
  scenes: { id: string }[] | undefined;
  pendingSceneScroll: SceneId | null;
  clearSceneScroll: () => void;
  setWordCount: (count: number) => void;
  initializedRef: MutableRefObject<boolean>;
  resetReconcile: () => void;
}

/**
 * Owns the editor's "has this chapter's content been loaded" lifecycle.
 *
 * One seed pass runs per (editor instance, chapterId, contentVersion, collab
 * mode). Each pass reads the chapter row straight from Dexie rather than from
 * the `useChapter` live query: callers that bump `contentVersion` (staged-edit
 * apply, version restore, scene surgery) do so only after their write has
 * resolved, so the fetch always sees the written row no matter whether the
 * live query's re-emission lands before, with, or after the bump. Re-emissions
 * without a bump (every autosave) never reseed, so unsaved typing is safe.
 *
 * `initializedRef` is false from the moment a new pass is needed until its
 * content has landed; the stale-doc effects in ChapterEditor and the comment
 * sync gate on it.
 *
 * Also consumes a pending sidebar scene-scroll request both right after
 * seeding (cross-chapter navigation) and while already seeded (same-chapter
 * clicks).
 */
export function useEditorSeed({
  editor,
  chapterId,
  isScreenplay,
  collabDoc,
  isCollabHost,
  contentVersion,
  scenes,
  pendingSceneScroll,
  clearSceneScroll,
  setWordCount,
  initializedRef,
  resetReconcile,
}: UseEditorSeedOptions) {
  // Latest values readable from the seed effect without making it a
  // dependency (which would wrongly reseed the doc when scenes change).
  const scenesRef = useRef(scenes);
  scenesRef.current = scenes;
  const pendingSceneScrollRef = useRef(pendingSceneScroll);
  pendingSceneScrollRef.current = pendingSceneScroll;

  // The (editor, key) pair whose content the editor currently holds.
  const seededRef = useRef<{ editor: Editor; key: string } | null>(null);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const key = `${chapterId}:${contentVersion}:${isCollabHost}`;
    const prev = seededRef.current;
    if (prev && prev.editor === editor && prev.key === key) return;

    initializedRef.current = false;
    // "Peers' state wins" applies only when an editor instance first joins a
    // collab doc that already has content. A later version bump on the same
    // editor is a deliberate local replacement (restore, scene surgery) and
    // is applied; the Collaboration extension pushes it into the Y.Doc.
    const isFreshEditor = !prev || prev.editor !== editor;
    let cancelled = false;

    void (async () => {
      const row = await getChapter(chapterId);
      if (cancelled || editor.isDestroyed) return;
      if (!row) return;
      const content = row.content ?? "";
      const skipForCollab =
        collabDoc !== null &&
        isFreshEditor &&
        (collabDoc.getXmlFragment("default").length > 0 ||
          content.length === 0);
      const wc = skipForCollab
        ? null
        : replaceEditorContent(editor, content, { isScreenplay });
      if (wc !== null) setWordCount(wc);
      initializedRef.current = true;
      seededRef.current = { editor, key };
      resetReconcile();
      // Consume a pending scene-scroll now that the doc is seeded — this is
      // the path that fires after cross-chapter navigation. Same-chapter
      // clicks are handled by the dedicated effect below.
      const pending = pendingSceneScrollRef.current;
      if (
        pending &&
        scenesRef.current &&
        scrollEditorToScene(editor, scenesRef.current, pending)
      ) {
        clearSceneScroll();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    editor,
    chapterId,
    contentVersion,
    isCollabHost,
    collabDoc,
    isScreenplay,
    setWordCount,
    clearSceneScroll,
    initializedRef,
    resetReconcile,
  ]);

  // Scroll to a scene requested from a sidebar. Handles the same-chapter case
  // (editor already seeded); cross-chapter scrolls are consumed by the seed
  // effect above.
  useEffect(() => {
    if (
      !pendingSceneScroll ||
      !editor ||
      editor.isDestroyed ||
      !initializedRef.current
    ) {
      return;
    }
    if (scrollEditorToScene(editor, scenes ?? [], pendingSceneScroll)) {
      clearSceneScroll();
    }
  }, [pendingSceneScroll, editor, scenes, clearSceneScroll, initializedRef]);
}
