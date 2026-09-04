import type { Editor } from "@tiptap/react";
import type { MutableRefObject } from "react";
import { useEffect, useMemo, useRef } from "react";
import { SCENE_TITLES_UPDATED_META } from "@/components/editor/extensions/SceneBreak";
import type { ProjectMode, Scene } from "@/db/schemas";
import { getTerm } from "@/lib/terminology";

// NUL as the memoization-key separator: scene ids are UUIDs, so it can
// never collide with an id or a title character.
const SCENE_TITLE_KEY_SEP = String.fromCharCode(0);

export interface UseSceneTitleSyncOptions {
  editor: Editor | null;
  scenes: Scene[] | undefined;
  activeProjectMode: ProjectMode | null;
  sceneTitlesRef: MutableRefObject<Map<string, string>>;
}

/**
 * Keep scene-break labels in sync with live scene data. Untitled scenes fall
 * back to a positional "Scene N" label matching the binder/details panels
 * (scenes are order-sorted, so the array index is the scene number). Keyed on
 * a title signature so word-count churn (which also mutates `scenes`) doesn't
 * trigger needless decoration rebuilds. The ref is read by the SceneBreak
 * plugin; a meta-only dispatch rebuilds its label decorations without marking
 * the editor dirty. A mode switch recreates the editor, refreshing the term.
 */
export function useSceneTitleSync({
  editor,
  scenes,
  activeProjectMode,
  sceneTitlesRef,
}: UseSceneTitleSyncOptions) {
  const scenesRef = useRef(scenes);
  scenesRef.current = scenes;

  const sceneTitlesKey = useMemo(
    () =>
      (scenes ?? [])
        .map((s) => `${s.id}${SCENE_TITLE_KEY_SEP}${s.title}`)
        .join("\n"),
    [scenes],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: sceneTitlesKey is the intentional trigger; the map is rebuilt from the latest scenesRef
  useEffect(() => {
    const sceneTerm = getTerm(activeProjectMode, "scene");
    sceneTitlesRef.current = new Map(
      (scenesRef.current ?? []).map((s, index) => [
        s.id,
        s.title.trim() || `${sceneTerm} ${index + 1}`,
      ]),
    );
    if (editor && !editor.isDestroyed) {
      editor.view.dispatch(
        editor.state.tr.setMeta(SCENE_TITLES_UPDATED_META, true),
      );
    }
  }, [editor, sceneTitlesKey]);
}
