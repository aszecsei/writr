"use client";

import type { Editor } from "@tiptap/react";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  SkipForward,
  X,
} from "lucide-react";
import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { setGrammarRuleEnabled } from "@/db/operations";
import type { GrammarResult } from "@/lib/grammar";
import { useGrammarStore } from "@/store/grammarStore";

interface GrammarScannerModalProps {
  editor: Editor | null;
}

export function GrammarScannerModal({ editor }: GrammarScannerModalProps) {
  const scannerOpen = useGrammarStore((s) => s.scannerOpen);
  const scanner = useGrammarStore((s) => s.scanner);
  const closeScanner = useGrammarStore((s) => s.closeScanner);
  const nextIssue = useGrammarStore((s) => s.nextIssue);
  const prevIssue = useGrammarStore((s) => s.prevIssue);
  const removeIssueAt = useGrammarStore((s) => s.removeIssueAt);
  const removeIssuesByRule = useGrammarStore((s) => s.removeIssuesByRule);
  const ignoreLint = useGrammarStore((s) => s.ignoreLint);

  const current: GrammarResult | null =
    scanner.issues[scanner.currentIndex] ?? null;

  const getContext = useCallback(() => {
    if (!editor || !current) return null;

    const doc = editor.state.doc;
    const docSize = doc.content.size;
    const contextPad = 40;

    const from = Math.max(1, current.from - contextPad);
    const to = Math.min(docSize, current.to + contextPad);

    const before = doc.textBetween(from, current.from, " ");
    const flagged = doc.textBetween(current.from, current.to, " ");
    const after = doc.textBetween(current.to, to, " ");

    return { before, flagged, after };
  }, [editor, current]);

  const context = getContext();

  // Scroll to the current issue.
  useEffect(() => {
    if (!editor || !current) return;

    const view = editor.view;
    const coords = view.coordsAtPos(current.from);
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
  }, [editor, current]);

  const handleApply = useCallback(
    (replacement: string) => {
      if (!editor || !current) return;
      editor
        .chain()
        .focus()
        .insertContentAt({ from: current.from, to: current.to }, replacement)
        .run();
      removeIssueAt(scanner.currentIndex);
    },
    [editor, current, removeIssueAt, scanner.currentIndex],
  );

  const handleIgnore = useCallback(() => {
    if (!current) return;
    ignoreLint(current.kind, current.problemText);
    removeIssueAt(scanner.currentIndex);
  }, [current, ignoreLint, removeIssueAt, scanner.currentIndex]);

  const handleDisableRule = useCallback(() => {
    if (!current) return;
    void setGrammarRuleEnabled(current.ruleKey, false);
    // Drop every issue from this rule, not just the current one.
    removeIssuesByRule(current.ruleKey);
  }, [current, removeIssuesByRule]);

  const handleSkip = useCallback(() => {
    nextIssue();
  }, [nextIssue]);

  // Keyboard shortcuts.
  useEffect(() => {
    if (!scannerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeScanner();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevIssue();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextIssue();
        return;
      }
      const num = Number.parseInt(e.key, 10);
      if (num >= 1 && num <= 5 && current?.suggestions[num - 1]) {
        e.preventDefault();
        handleApply(current.suggestions[num - 1].replacement);
        return;
      }
      if (e.key === "Enter" && current?.suggestions[0]) {
        e.preventDefault();
        handleApply(current.suggestions[0].replacement);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [scannerOpen, closeScanner, prevIssue, nextIssue, current, handleApply]);

  if (!scannerOpen) return null;

  if (scanner.issues.length === 0) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Grammar Check Complete
            </h2>
            <button
              type="button"
              onClick={closeScanner}
              className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
            >
              <X size={18} />
            </button>
          </div>
          <p className="text-neutral-600 dark:text-neutral-400">
            No grammar issues found.
          </p>
          <button
            type="button"
            onClick={closeScanner}
            className="mt-4 w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
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
      <div className="w-full max-w-lg rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Grammar Scanner
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500">
              {scanner.currentIndex + 1} of {scanner.issues.length}
            </span>
            <button
              type="button"
              onClick={closeScanner}
              className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
              {current?.kind}
            </div>
            <div className="text-base font-medium text-neutral-900 dark:text-neutral-100">
              {current?.message}
            </div>
          </div>

          {context && (
            <div className="mb-4">
              <div className="mb-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Context
              </div>
              <div className="rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
                <span className="text-neutral-600 dark:text-neutral-400">
                  ...{context.before}
                </span>
                <span className="rounded bg-blue-100 px-0.5 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {context.flagged}
                </span>
                <span className="text-neutral-600 dark:text-neutral-400">
                  {context.after}...
                </span>
              </div>
            </div>
          )}

          <div className="mb-4">
            <div className="mb-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">
              Suggestions
            </div>
            <div className="flex flex-wrap gap-2">
              {current?.suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.label}:${suggestion.replacement}`}
                  type="button"
                  onClick={() => handleApply(suggestion.replacement)}
                  className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                >
                  <span className="text-xs text-neutral-400">{index + 1}</span>
                  {suggestion.label}
                </button>
              ))}
              {(current?.suggestions.length ?? 0) === 0 && (
                <span className="text-sm italic text-neutral-500">
                  No suggestions available
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleIgnore}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-700"
            >
              <EyeOff size={14} />
              Ignore
            </button>
            {current?.ruleKey && (
              <button
                type="button"
                onClick={handleDisableRule}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-700"
              >
                <Ban size={14} />
                Disable rule
              </button>
            )}
            <button
              type="button"
              onClick={handleSkip}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-700"
            >
              <SkipForward size={14} />
              Skip
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3 dark:border-neutral-700">
          <button
            type="button"
            onClick={prevIssue}
            disabled={scanner.issues.length <= 1}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-700"
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <div className="text-xs text-neutral-500">
            Use ← → to navigate, 1-5 for suggestions
          </div>
          <button
            type="button"
            onClick={nextIssue}
            disabled={scanner.issues.length <= 1}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-700"
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
