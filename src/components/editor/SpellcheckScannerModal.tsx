"use client";

import type { Editor } from "@tiptap/react";
import { BookPlus, BookType, SkipForward } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  addWordToAppDictionary,
  addWordToProjectDictionary,
} from "@/db/operations";
import type { ProjectId } from "@/db/schemas";
import { scrollToPos } from "@/lib/editor/scroll";
import { getSpellcheckService } from "@/lib/spellcheck";
import {
  type MisspelledWord,
  useSpellcheckStore,
} from "@/store/spellcheckStore";
import { isSpellcheckScannerModal, useUiStore } from "@/store/uiStore";
import { IssueScannerModal } from "./IssueScannerModal";

interface SpellcheckScannerModalProps {
  editor: Editor | null;
  projectId: ProjectId;
}

export function SpellcheckScannerModal({
  editor,
  projectId,
}: SpellcheckScannerModalProps) {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const scanner = useSpellcheckStore((s) => s.scanner);
  const nextMisspelling = useSpellcheckStore((s) => s.next);
  const prevMisspelling = useSpellcheckStore((s) => s.prev);
  const removeMisspellingAt = useSpellcheckStore((s) => s.removeAt);
  const addToIgnored = useSpellcheckStore((s) => s.addToIgnored);

  const isOpen = isSpellcheckScannerModal(modal);
  const currentWord: MisspelledWord | null =
    scanner.items[scanner.currentIndex] ?? null;

  // Compute suggestions on-demand for the current word
  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: we only want to recompute when word text or position changes
  useEffect(() => {
    if (!currentWord) {
      setCurrentSuggestions([]);
      return;
    }
    const service = getSpellcheckService();
    setCurrentSuggestions(service.getSuggestions(currentWord.word));
  }, [currentWord?.word, currentWord?.from]);

  useEffect(() => {
    if (!isOpen || !editor || !currentWord) return;
    scrollToPos(editor, currentWord.from, { center: true });
  }, [isOpen, editor, currentWord]);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      if (!editor || !currentWord) return;

      editor
        .chain()
        .focus()
        .insertContentAt(
          { from: currentWord.from, to: currentWord.to },
          suggestion,
        )
        .run();

      removeMisspellingAt(scanner.currentIndex);
    },
    [editor, currentWord, removeMisspellingAt, scanner.currentIndex],
  );

  const handleAddToAppDictionary = useCallback(async () => {
    if (!currentWord) return;
    addToIgnored(currentWord.word.toLowerCase());
    await addWordToAppDictionary(currentWord.word);
    removeMisspellingAt(scanner.currentIndex);
  }, [currentWord, addToIgnored, removeMisspellingAt, scanner.currentIndex]);

  const handleAddToProjectDictionary = useCallback(async () => {
    if (!currentWord) return;
    addToIgnored(currentWord.word.toLowerCase());
    await addWordToProjectDictionary(projectId, currentWord.word);
    removeMisspellingAt(scanner.currentIndex);
  }, [
    currentWord,
    addToIgnored,
    projectId,
    removeMisspellingAt,
    scanner.currentIndex,
  ]);

  const handleIgnore = useCallback(() => {
    if (!currentWord) return;
    addToIgnored(currentWord.word.toLowerCase());
    removeMisspellingAt(scanner.currentIndex);
  }, [currentWord, addToIgnored, removeMisspellingAt, scanner.currentIndex]);

  const handleSkip = useCallback(() => {
    nextMisspelling();
  }, [nextMisspelling]);

  if (!isOpen) return null;

  const context = (() => {
    if (!editor || !currentWord) return null;

    const doc = editor.state.doc;
    const docSize = doc.content.size;

    const contextBefore = 30;
    const contextAfter = 30;

    const from = Math.max(1, currentWord.from - contextBefore);
    const to = Math.min(docSize, currentWord.to + contextAfter);

    const text = doc.textBetween(from, to, " ");

    // Find the word within the extracted text (position math doesn't work
    // reliably due to how textBetween handles block boundaries)
    const wordIndex = text.indexOf(currentWord.word);
    if (wordIndex === -1) {
      return { before: text, highlighted: currentWord.word, after: "" };
    }

    return {
      before: text.slice(0, wordIndex),
      highlighted: text.slice(wordIndex, wordIndex + currentWord.word.length),
      after: text.slice(wordIndex + currentWord.word.length),
    };
  })();

  return (
    <IssueScannerModal
      title="Spellcheck Scanner"
      currentIndex={scanner.currentIndex}
      total={scanner.items.length}
      headline={
        <>
          <div className="mb-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Word
          </div>
          <div className="text-xl font-semibold text-red-600 dark:text-red-400">
            {currentWord?.word}
          </div>
        </>
      }
      context={
        context
          ? {
              ...context,
              highlightClassName:
                "rounded bg-red-100 px-0.5 font-semibold text-red-600 dark:bg-red-900/30 dark:text-red-400",
            }
          : null
      }
      suggestions={currentSuggestions.map((suggestion) => ({
        key: suggestion,
        label: suggestion,
        onSelect: () => handleSuggestionClick(suggestion),
      }))}
      actions={[
        {
          key: "app-dictionary",
          label: "Add to App",
          icon: BookType,
          onClick: handleAddToAppDictionary,
        },
        {
          key: "project-dictionary",
          label: "Add to Project",
          icon: BookPlus,
          onClick: handleAddToProjectDictionary,
        },
        { key: "ignore", label: "Ignore", onClick: handleIgnore },
        {
          key: "skip",
          label: "Skip",
          icon: SkipForward,
          onClick: handleSkip,
        },
      ]}
      onNext={nextMisspelling}
      onPrev={prevMisspelling}
      onClose={closeModal}
      emptyState={{
        title: "Spellcheck Complete",
        message: "No spelling errors found.",
      }}
    />
  );
}
