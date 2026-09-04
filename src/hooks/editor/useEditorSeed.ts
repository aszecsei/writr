import type { Editor } from "@tiptap/react";
import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";
import type * as Y from "yjs";
import type { Chapter, ChapterId, SceneId } from "@/db/schemas";
import { getWordCount } from "@/lib/editor/tiptap-storage";
import { fountainToProseMirror, parseFountain } from "@/lib/fountain";

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

/** The nearest HTMLElement for a DOM node (itself if already an element). */
function elementFor(node: Node | null | undefined): HTMLElement | null {
  if (!node) return null;
  return node instanceof HTMLElement ? node : node.parentElement;
}

/**
 * Scroll the editor to a scene and place the caret at its start. Returns false
 * (a no-op) when the scene doesn't belong to this chapter's loaded rows — the
 * caller then leaves the scroll request pending for the right chapter's editor.
 * The core scene (no marker) scrolls to the top.
 *
 * Scrolls via the DOM `scrollIntoView` (not ProseMirror's transaction-level
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
    const target =
      markerPos !== null
        ? elementFor(editor.view.nodeDOM(markerPos))
        : elementFor(editor.view.domAtPos(1).node);
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
  return true;
}

export interface UseEditorSeedOptions {
  editor: Editor | null;
  chapter: Chapter | undefined;
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
 * Owns the editor's "has this chapter's content been loaded" lifecycle:
 * seeds the doc from Dexie (or the collab Y.Doc) once per chapter/session,
 * resets that flag when the chapter, a staged-edit content version bump, or
 * collab mode changes, and consumes a pending sidebar scene-scroll request
 * both right after seeding (cross-chapter navigation) and while already
 * seeded (same-chapter clicks).
 */
export function useEditorSeed({
  editor,
  chapter,
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
  // Latest values readable from the content-seed effect without making it a
  // dependency (which would wrongly reseed the doc when scenes change).
  const scenesRef = useRef(scenes);
  scenesRef.current = scenes;
  const pendingSceneScrollRef = useRef(pendingSceneScroll);
  pendingSceneScrollRef.current = pendingSceneScroll;

  // Load content from Dexie into the editor once. In collab mode we only
  // seed the shared Y.Doc when it's empty; otherwise the relay's buffered
  // state has already been applied via the Collaboration extension.
  useEffect(() => {
    if (!editor || !chapter || editor.isDestroyed || initializedRef.current) {
      return;
    }
    if (collabDoc) {
      const isYDocEmpty = collabDoc.getXmlFragment("default").length === 0;
      if (isYDocEmpty && (chapter.content || "").length > 0) {
        if (isScreenplay) {
          const elements = parseFountain(chapter.content || "");
          const json = fountainToProseMirror(elements);
          editor.commands.setContent(json);
        } else {
          editor.commands.setContent(chapter.content || "");
        }
      }
      // If the Y.Doc has content we leave it alone — peers' state wins.
    } else if (isScreenplay) {
      const elements = parseFountain(chapter.content || "");
      const json = fountainToProseMirror(elements);
      editor.commands.setContent(json);
    } else {
      editor.commands.setContent(chapter.content || "");
    }
    const wc = getWordCount(editor.storage);
    setWordCount(wc);
    initializedRef.current = true;
    // Consume a pending scene-scroll now that the doc is seeded — this is the
    // path that fires after cross-chapter navigation. Same-chapter clicks are
    // handled by the dedicated effect below.
    const pending = pendingSceneScrollRef.current;
    if (
      pending &&
      scenesRef.current &&
      scrollEditorToScene(editor, scenesRef.current, pending)
    ) {
      clearSceneScroll();
    }
  }, [
    editor,
    chapter,
    setWordCount,
    isScreenplay,
    collabDoc,
    clearSceneScroll,
    initializedRef,
  ]);

  // Reset initialized flag when chapterId, contentVersion, or collab mode
  // changes — entering or leaving a session needs a fresh seed pass.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on chapterId/contentVersion/collab change
  useEffect(() => {
    initializedRef.current = false;
    resetReconcile();
  }, [chapterId, contentVersion, resetReconcile, isCollabHost]);

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
