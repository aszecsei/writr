"use client";

import type { Editor } from "@tiptap/react";
import {
  BookPlus,
  BookType,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addWordToAppDictionary,
  addWordToProjectDictionary,
} from "@/db/operations";
import { getSpellcheckService } from "@/lib/spellcheck";
import {
  type MisspelledWord,
  useSpellcheckStore,
} from "@/store/spellcheckStore";

interface SpellcheckScannerModalProps {
  editor: Editor | null;
  projectId: string;
}

export function SpellcheckScannerModal({
  editor,
  projectId,
}: SpellcheckScannerModalProps) {
  const scannerOpen = useSpellcheckStore((s) => s.scannerOpen);
  const scanner = useSpellcheckStore((s) => s.scanner);
  const closeScanner = useSpellcheckStore((s) => s.closeScanner);
  const nextMisspelling = useSpellcheckStore((s) => s.nextMisspelling);
  const prevMisspelling = useSpellcheckStore((s) => s.prevMisspelling);
  const removeMisspellingAt = useSpellcheckStore((s) => s.removeMisspellingAt);
  const addToIgnored = useSpellcheckStore((s) => s.addToIgnored);

  const modalRef = useRef<HTMLDivElement>(null);

  const currentWord: MisspelledWord | null =
    scanner.misspellings[scanner.currentIndex] ?? null;

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

  // Get context around the word
  const getContext = useCallback(() => {
    if (!editor || !currentWord) return "";

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
      // Fallback: just show the whole text with the word from our data
      return {
        before: text,
        word: currentWord.word,
        after: "",
      };
    }

    return {
      before: text.slice(0, wordIndex),
      word: text.slice(wordIndex, wordIndex + currentWord.word.length),
      after: text.slice(wordIndex + currentWord.word.length),
    };
  }, [editor, currentWord]);

  const context = getContext();

  // Scroll to the current word
  useEffect(() => {
    if (!editor || !currentWord) return;

    // Scroll to position
    const view = editor.view;
    const coords = view.coordsAtPos(currentWord.from);

    // Calculate scroll position to center the word
    const scrollContainer = view.dom.closest(".overflow-y-auto");
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const scrollTop =
        coords.top -
        containerRect.top +
        scrollContainer.scrollTop -
        containerRect.height / 2;
      scrollContainer.scrollTo({ top: scrollTop, behavior: "smooth" });
    }
  }, [editor, currentWord]);

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

      // Remove from list and advance
      removeMisspellingAt(scanner.currentIndex);
    },
    [editor, currentWord, removeMisspellingAt, scanner.currentIndex],
  );

  const handleAddToAppDictionary = useCallback(async () => {
    if (!currentWord) return;
    addToIgnored(currentWord.word);
    await addWordToAppDictionary(currentWord.word);
    removeMisspellingAt(scanner.currentIndex);
  }, [currentWord, addToIgnored, removeMisspellingAt, scanner.currentIndex]);

  const handleAddToProjectDictionary = useCallback(async () => {
    if (!currentWord) return;
    addToIgnored(currentWord.word);
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
    addToIgnored(currentWord.word);
    removeMisspellingAt(scanner.currentIndex);
  }, [currentWord, addToIgnored, removeMisspellingAt, scanner.currentIndex]);

  const handleSkip = useCallback(() => {
    nextMisspelling();
  }, [nextMisspelling]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!scannerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeScanner();
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevMisspelling();
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextMisspelling();
        return;
      }

      // Number keys 1-5 for suggestions
      const num = Number.parseInt(e.key, 10);
      if (num >= 1 && num <= 5 && currentSuggestions[num - 1]) {
        e.preventDefault();
        handleSuggestionClick(currentSuggestions[num - 1]);
        return;
      }

      // Enter for first suggestion
      if (e.key === "Enter" && currentSuggestions[0]) {
        e.preventDefault();
        handleSuggestionClick(currentSuggestions[0]);
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    scannerOpen,
    closeScanner,
    prevMisspelling,
    nextMisspelling,
    currentSuggestions,
    handleSuggestionClick,
  ]);

  if (!scannerOpen) return null;

  // If no misspellings left, show completion message
  if (scanner.misspellings.length === 0) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div
          ref={modalRef}
          className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Spellcheck Complete
            </h2>
            <button
              type="button"
              onClick={closeScanner}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              <X size={18} />
            </button>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400">
            No spelling errors found.
          </p>
          <button
            type="button"
            onClick={closeScanner}
            className="mt-4 w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Close
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={modalRef}
        className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Spellcheck Scanner
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">
              {scanner.currentIndex + 1} of {scanner.misspellings.length}
            </span>
            <button
              type="button"
              onClick={closeScanner}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Word and context */}
          <div className="mb-4">
            <div className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Word
            </div>
            <div className="text-xl font-semibold text-red-600 dark:text-red-400">
              {currentWord?.word}
            </div>
          </div>

          {/* Context */}
          {context && typeof context === "object" && (
            <div className="mb-4">
              <div className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Context
              </div>
              <div className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
                <span className="text-zinc-600 dark:text-zinc-400">
                  ...{context.before}
                </span>
                <span className="rounded bg-red-100 px-0.5 font-semibold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                  {context.word}
                </span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {context.after}...
                </span>
              </div>
            </div>
          )}

          {/* Suggestions */}
          <div className="mb-4">
            <div className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Suggestions
            </div>
            <div className="flex flex-wrap gap-2">
              {currentSuggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                >
                  <span className="text-xs text-zinc-400">{index + 1}</span>
                  {suggestion}
                </button>
              ))}
              {currentSuggestions.length === 0 && (
                <span className="text-sm italic text-zinc-500">
                  No suggestions available
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAddToAppDictionary}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-700"
            >
              <BookType size={14} />
              Add to App
            </button>
            <button
              type="button"
              onClick={handleAddToProjectDictionary}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-700"
            >
              <BookPlus size={14} />
              Add to Project
            </button>
            <button
              type="button"
              onClick={handleIgnore}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-700"
            >
              Ignore
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-700"
            >
              <SkipForward size={14} />
              Skip
            </button>
          </div>
        </div>

        {/* Footer - Navigation */}
        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <button
            type="button"
            onClick={prevMisspelling}
            disabled={scanner.misspellings.length <= 1}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-700"
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <div className="text-xs text-zinc-500">
            Use ← → to navigate, 1-5 for suggestions
          </div>
          <button
            type="button"
            onClick={nextMisspelling}
            disabled={scanner.misspellings.length <= 1}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-700"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
