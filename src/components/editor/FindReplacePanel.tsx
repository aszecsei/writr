"use client";

import type { Editor } from "@tiptap/react";
import {
  ALargeSmall,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Regex,
  WholeWord,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useFindReplaceStore } from "@/store/findReplaceStore";
import {
  getSearchState,
  SEARCH_UPDATED_META,
} from "./extensions/SearchAndReplace";

interface FindReplacePanelProps {
  editor: Editor | null;
}

export function FindReplacePanel({ editor }: FindReplacePanelProps) {
  const isOpen = useFindReplaceStore((s) => s.isOpen);
  const mode = useFindReplaceStore((s) => s.mode);
  const focusTrigger = useFindReplaceStore((s) => s.focusTrigger);
  const searchTerm = useFindReplaceStore((s) => s.searchTerm);
  const replaceTerm = useFindReplaceStore((s) => s.replaceTerm);
  const caseSensitive = useFindReplaceStore((s) => s.caseSensitive);
  const wholeWord = useFindReplaceStore((s) => s.wholeWord);
  const useRegex = useFindReplaceStore((s) => s.useRegex);
  const matchCount = useFindReplaceStore((s) => s.matchCount);
  const currentMatch = useFindReplaceStore((s) => s.currentMatch);

  const setSearchTerm = useFindReplaceStore((s) => s.setSearchTerm);
  const setReplaceTerm = useFindReplaceStore((s) => s.setReplaceTerm);
  const toggleCaseSensitive = useFindReplaceStore((s) => s.toggleCaseSensitive);
  const toggleWholeWord = useFindReplaceStore((s) => s.toggleWholeWord);
  const toggleUseRegex = useFindReplaceStore((s) => s.toggleUseRegex);
  const toggleMode = useFindReplaceStore((s) => s.toggleMode);
  const setMatchInfo = useFindReplaceStore((s) => s.setMatchInfo);
  const openFindReplace = useFindReplaceStore((s) => s.openFindReplace);
  const close = useFindReplaceStore((s) => s.close);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus search input when panel opens or re-triggered.
  // focusTrigger is intentionally in the dep array to re-fire the effect
  // even when isOpen is already true (e.g. Ctrl+F pressed twice).
  useEffect(() => {
    // Reference focusTrigger so the linter sees it used in the body
    void focusTrigger;
    if (isOpen) {
      // Small delay to let the panel render
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 50);
    }
  }, [focusTrigger, isOpen]);

  // Dispatch search to the ProseMirror plugin
  const dispatchSearch = useCallback(
    (
      term: string,
      opts: {
        caseSensitive: boolean;
        wholeWord: boolean;
        useRegex: boolean;
      },
      currentIndex?: number,
    ) => {
      if (!editor || editor.isDestroyed) return;

      const tr = editor.state.tr.setMeta(SEARCH_UPDATED_META, {
        searchTerm: term,
        caseSensitive: opts.caseSensitive,
        wholeWord: opts.wholeWord,
        useRegex: opts.useRegex,
        currentIndex,
      });
      editor.view.dispatch(tr);

      // Read back match info
      setTimeout(() => {
        if (!editor || editor.isDestroyed) return;
        const state = getSearchState(editor.state);
        if (state) {
          setMatchInfo(state.matches.length, state.currentIndex);
        }
      }, 0);
    },
    [editor, setMatchInfo],
  );

  // Debounced search dispatch on search term change
  useEffect(() => {
    if (!isOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      dispatchSearch(searchTerm, { caseSensitive, wholeWord, useRegex });
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm, caseSensitive, wholeWord, useRegex, isOpen, dispatchSearch]);

  // Clear decorations on close
  useEffect(() => {
    if (!isOpen && editor && !editor.isDestroyed) {
      const tr = editor.state.tr.setMeta(SEARCH_UPDATED_META, {
        searchTerm: "",
        caseSensitive: false,
        wholeWord: false,
        useRegex: false,
      });
      editor.view.dispatch(tr);
    }
  }, [isOpen, editor]);

  /** Scroll the editor so the current search match is visible. */
  const scrollToMatch = useCallback(() => {
    setTimeout(() => {
      if (!editor || editor.isDestroyed) return;
      const s = getSearchState(editor.state);
      if (s && s.matches.length > 0) {
        const match = s.matches[s.currentIndex];
        editor.commands.setTextSelection(match.from);
        const view = editor.view;
        const coords = view.coordsAtPos(match.from);
        const dom = view.dom.closest(".overflow-y-auto");
        if (dom) {
          const rect = dom.getBoundingClientRect();
          const targetY =
            coords.top - rect.top + dom.scrollTop - rect.height / 2;
          dom.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
        }
      }
    }, 0);
  }, [editor]);

  const handleClose = useCallback(() => {
    close();
    // Return focus to editor
    if (editor && !editor.isDestroyed) {
      editor.commands.focus();
    }
  }, [close, editor]);

  const findNext = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const state = getSearchState(editor.state);
    if (!state || state.matches.length === 0) return;

    const nextIndex = (state.currentIndex + 1) % state.matches.length;
    dispatchSearch(
      searchTerm,
      { caseSensitive, wholeWord, useRegex },
      nextIndex,
    );
    scrollToMatch();
  }, [
    editor,
    searchTerm,
    caseSensitive,
    wholeWord,
    useRegex,
    dispatchSearch,
    scrollToMatch,
  ]);

  const findPrevious = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const state = getSearchState(editor.state);
    if (!state || state.matches.length === 0) return;

    const prevIndex =
      (state.currentIndex - 1 + state.matches.length) % state.matches.length;
    dispatchSearch(
      searchTerm,
      { caseSensitive, wholeWord, useRegex },
      prevIndex,
    );
    scrollToMatch();
  }, [
    editor,
    searchTerm,
    caseSensitive,
    wholeWord,
    useRegex,
    dispatchSearch,
    scrollToMatch,
  ]);

  const replaceCurrent = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const state = getSearchState(editor.state);
    if (!state || state.matches.length === 0) return;

    const match = state.matches[state.currentIndex];
    editor
      .chain()
      .focus()
      .insertContentAt({ from: match.from, to: match.to }, replaceTerm)
      .run();

    // Re-dispatch search to update matches
    setTimeout(() => {
      dispatchSearch(
        searchTerm,
        { caseSensitive, wholeWord, useRegex },
        state.currentIndex,
      );
    }, 0);
  }, [
    editor,
    replaceTerm,
    searchTerm,
    caseSensitive,
    wholeWord,
    useRegex,
    dispatchSearch,
  ]);

  const replaceAll = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const state = getSearchState(editor.state);
    if (!state || state.matches.length === 0) return;

    // Apply all replacements in reverse order in a single transaction
    const tr = editor.state.tr;
    const matches = [...state.matches].reverse();
    for (const match of matches) {
      if (replaceTerm) {
        tr.insertText(replaceTerm, match.from, match.to);
      } else {
        tr.delete(match.from, match.to);
      }
    }
    editor.view.dispatch(tr);

    // Re-dispatch search
    setTimeout(() => {
      dispatchSearch(searchTerm, { caseSensitive, wholeWord, useRegex });
    }, 0);
  }, [
    editor,
    replaceTerm,
    searchTerm,
    caseSensitive,
    wholeWord,
    useRegex,
    dispatchSearch,
  ]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          findPrevious();
        } else {
          findNext();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        searchInputRef.current?.select();
      } else if (e.key === "h" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        openFindReplace();
      }
    },
    [findNext, findPrevious, handleClose, openFindReplace],
  );

  const handleReplaceKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === "h" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
      }
    },
    [handleClose],
  );

  if (!isOpen) return null;

  const toggleBtnBase =
    "rounded p-0.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400";
  const toggleBtnActive =
    "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100";
  const toggleBtnInactive =
    "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-500 dark:hover:bg-neutral-800";

  return (
    <div className="absolute right-4 top-2 z-30 w-84 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex gap-1">
        {/* Chevron toggle for find/replace mode */}
        <button
          type="button"
          title="Toggle Replace (Ctrl+H)"
          onClick={toggleMode}
          className="mt-0.5 shrink-0 rounded p-0.5 text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          {mode === "find-replace" ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </button>

        <div className="min-w-0 flex-1">
          {/* Row 1: Search */}
          <div className="flex items-center gap-1.5">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Find..."
              className="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs text-neutral-900 placeholder-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
            />
            <span className="shrink-0 text-[10px] text-neutral-500 dark:text-neutral-400">
              {searchTerm
                ? matchCount > 0
                  ? `${currentMatch + 1}/${matchCount}`
                  : "0"
                : ""}
            </span>
            <button
              type="button"
              title="Previous match (Shift+Enter)"
              onClick={findPrevious}
              disabled={matchCount === 0}
              className="rounded p-0.5 text-neutral-600 transition-colors hover:bg-neutral-100 disabled:text-neutral-300 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:disabled:text-neutral-600"
            >
              <ChevronUp size={12} />
            </button>
            <button
              type="button"
              title="Next match (Enter)"
              onClick={findNext}
              disabled={matchCount === 0}
              className="rounded p-0.5 text-neutral-600 transition-colors hover:bg-neutral-100 disabled:text-neutral-300 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:disabled:text-neutral-600"
            >
              <ChevronDown size={12} />
            </button>
            <button
              type="button"
              title="Case sensitive"
              onClick={toggleCaseSensitive}
              className={`${toggleBtnBase} ${caseSensitive ? toggleBtnActive : toggleBtnInactive}`}
            >
              <ALargeSmall size={12} />
            </button>
            <button
              type="button"
              title="Whole word"
              onClick={toggleWholeWord}
              className={`${toggleBtnBase} ${wholeWord ? toggleBtnActive : toggleBtnInactive}`}
            >
              <WholeWord size={12} />
            </button>
            <button
              type="button"
              title="Regular expression"
              onClick={toggleUseRegex}
              className={`${toggleBtnBase} ${useRegex ? toggleBtnActive : toggleBtnInactive}`}
            >
              <Regex size={12} />
            </button>
            <button
              type="button"
              title="Close (Escape)"
              onClick={handleClose}
              className="rounded p-0.5 text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <X size={12} />
            </button>
          </div>

          {/* Row 2: Replace (find-replace mode only) */}
          {mode === "find-replace" && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <input
                type="text"
                value={replaceTerm}
                onChange={(e) => setReplaceTerm(e.target.value)}
                onKeyDown={handleReplaceKeyDown}
                placeholder="Replace..."
                className="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs text-neutral-900 placeholder-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
              />
              <button
                type="button"
                onClick={replaceCurrent}
                disabled={matchCount === 0}
                className="shrink-0 rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] text-neutral-700 transition-colors hover:bg-neutral-100 disabled:text-neutral-300 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:disabled:text-neutral-600"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={replaceAll}
                disabled={matchCount === 0}
                className="shrink-0 rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] text-neutral-700 transition-colors hover:bg-neutral-100 disabled:text-neutral-300 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:disabled:text-neutral-600"
              >
                All
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
