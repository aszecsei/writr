import type { MutableRefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useCharactersByProject,
  useLocationsByProject,
} from "@/hooks/data/useBibleEntries";
import { useCombinedDictionaryWords } from "@/hooks/data/useDictionary";
import { getSpellcheckService, type SpellcheckService } from "@/lib/spellcheck";
import { combineCustomWords } from "@/lib/spellcheck/auto-populate";
import { useSpellcheckStore } from "@/store/spellcheckStore";

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
  /** Increments when spellcheck state changes and decorations need rebuilding. */
  spellcheckVersion: number;
}

/**
 * Manages spellcheck lifecycle: loading the service, combining custom
 * words from dictionary + story bible, and tracking when rebuilds are needed.
 *
 * Returns refs for extension configuration (used before editor creation)
 * and a `spellcheckVersion` counter that increments whenever the editor's
 * spellcheck decorations should be rebuilt. The caller is responsible for
 * dispatching the rebuild transaction to the editor.
 */
export function useEditorSpellcheck(projectId: string | null): SpellcheckRefs {
  const spellcheckEnabled = useSpellcheckStore((s) => s.enabled);
  const ignoredWords = useSpellcheckStore((s) => s.ignoredWords);
  const openContextMenu = useSpellcheckStore((s) => s.openContextMenu);

  const dictionaryWords = useCombinedDictionaryWords(projectId ?? undefined);
  const characters = useCharactersByProject(projectId);
  const locations = useLocationsByProject(projectId);

  const spellcheckerRef = useRef<SpellcheckService | null>(null);
  const customWordsRef = useRef<Set<string>>(new Set());
  const spellcheckEnabledRef = useRef(spellcheckEnabled);
  spellcheckEnabledRef.current = spellcheckEnabled;
  const ignoredWordsRef = useRef<Set<string>>(new Set());
  ignoredWordsRef.current = ignoredWords;
  const [spellcheckLoaded, setSpellcheckLoaded] = useState(() =>
    getSpellcheckService().isLoaded(),
  );

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

  // Initialize spellcheck service
  useEffect(() => {
    const service = getSpellcheckService();
    spellcheckerRef.current = service;

    if (service.isLoaded()) {
      setSpellcheckLoaded(true);
    } else if (!service.isLoading()) {
      service.load().then(() => {
        setSpellcheckLoaded(true);
      });
    }
  }, []);

  // Track when spellcheck state changes so the caller can rebuild decorations
  const [spellcheckVersion, setSpellcheckVersion] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: these deps intentionally trigger version bumps
  useEffect(() => {
    setSpellcheckVersion((v) => v + 1);
  }, [combinedCustomWords, spellcheckEnabled, ignoredWords, spellcheckLoaded]);

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
    spellcheckerRef,
    customWordsRef,
    spellcheckEnabledRef,
    ignoredWordsRef,
    onSpellcheckContextMenu,
    spellcheckVersion,
  };
}
