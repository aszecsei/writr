import type { MutableRefObject } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import {
  useCharactersByProject,
  useLocationsByProject,
} from "@/hooks/data/useBibleEntries";
import { useCombinedDictionaryWords } from "@/hooks/data/useDictionary";
import { getSpellcheckService, type SpellcheckService } from "@/lib/spellcheck";
import { combineCustomWords } from "@/lib/spellcheck/auto-populate";
import { useSpellcheckStore } from "@/store/spellcheckStore";
import { useEditorChecker } from "./useEditorChecker";

interface SpellcheckRefs {
  spellcheckerRef: MutableRefObject<SpellcheckService | null>;
  customWordsRef: MutableRefObject<Set<string>>;
  spellcheckEnabledRef: MutableRefObject<boolean>;
  ignoredWordsRef: MutableRefObject<Set<string>>;
  onSpellcheckContextMenu: (
    word: string,
    from: number,
    to: number,
    suggestions: string[],
    rect: DOMRect,
  ) => void;
  /** Changes identity whenever spellcheck state changes and decorations need rebuilding. */
  spellcheckVersion: readonly unknown[];
}

/**
 * Manages spellcheck lifecycle: loading the service, combining custom
 * words from dictionary + story bible, and tracking when rebuilds are needed.
 *
 * Returns refs for extension configuration (used before editor creation)
 * and a `spellcheckVersion` value that changes identity whenever the editor's
 * spellcheck decorations should be rebuilt. The caller is responsible for
 * dispatching the rebuild transaction to the editor.
 */
export function useEditorSpellcheck(projectId: string | null): SpellcheckRefs {
  const spellcheckEnabled = useSpellcheckStore((s) => s.enabled);
  const ignoredWords = useSpellcheckStore((s) => s.ignored);
  const openContextMenu = useSpellcheckStore((s) => s.openContextMenu);
  const setSpellcheckEnabled = useSpellcheckStore((s) => s.setEnabled);

  const persistedSpellcheckEnabled = useAppSettings()?.spellcheckEnabled;
  useEffect(() => {
    if (persistedSpellcheckEnabled !== undefined) {
      setSpellcheckEnabled(persistedSpellcheckEnabled);
    }
  }, [persistedSpellcheckEnabled, setSpellcheckEnabled]);

  const dictionaryWords = useCombinedDictionaryWords(projectId);
  const characters = useCharactersByProject(projectId);
  const locations = useLocationsByProject(projectId);

  const customWordsRef = useRef<Set<string>>(new Set());
  const spellcheckEnabledRef = useRef(spellcheckEnabled);
  spellcheckEnabledRef.current = spellcheckEnabled;

  const combinedCustomWords = useMemo(() => {
    return combineCustomWords(
      dictionaryWords,
      characters ?? [],
      locations ?? [],
    );
  }, [dictionaryWords, characters, locations]);

  useEffect(() => {
    customWordsRef.current = combinedCustomWords;
  }, [combinedCustomWords]);

  const { serviceRef, ignoredRef, loaded } = useEditorChecker({
    enabled: true,
    getService: getSpellcheckService,
    ignored: ignoredWords,
  });

  const spellcheckVersion = useMemo(
    () =>
      [combinedCustomWords, spellcheckEnabled, ignoredWords, loaded] as const,
    [combinedCustomWords, spellcheckEnabled, ignoredWords, loaded],
  );

  const onSpellcheckContextMenu = useCallback(
    (
      word: string,
      from: number,
      to: number,
      suggestions: string[],
      rect: DOMRect,
    ) => {
      openContextMenu({ word, from, to, suggestions, rect });
    },
    [openContextMenu],
  );

  return {
    spellcheckerRef: serviceRef,
    customWordsRef,
    spellcheckEnabledRef,
    ignoredWordsRef: ignoredRef,
    onSpellcheckContextMenu,
    spellcheckVersion,
  };
}
