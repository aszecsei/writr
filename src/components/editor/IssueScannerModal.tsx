"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";

export interface IssueScannerAction {
  key: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
}

export interface IssueScannerSuggestion {
  key: string;
  label: string;
  onSelect: () => void;
}

export interface IssueScannerContext {
  before: string;
  highlighted: string;
  after: string;
  highlightClassName?: string;
}

interface IssueScannerModalProps {
  title: string;
  currentIndex: number;
  total: number;
  headline: ReactNode;
  context: IssueScannerContext | null;
  suggestions: IssueScannerSuggestion[];
  actions: IssueScannerAction[];
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  emptyState: { title: string; message: string };
}

/**
 * Shared scanner UI for the spellcheck and grammar checkers: a word/issue
 * headline, surrounding context, numbered suggestions, and a row of
 * domain-specific actions, with 1-5/Enter/arrow keyboard shortcuts.
 */
export function IssueScannerModal({
  title,
  currentIndex,
  total,
  headline,
  context,
  suggestions,
  actions,
  onNext,
  onPrev,
  onClose,
  emptyState,
}: IssueScannerModalProps) {
  useEffect(() => {
    if (total === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
        return;
      }

      const num = Number.parseInt(e.key, 10);
      if (num >= 1 && num <= 5 && suggestions[num - 1]) {
        e.preventDefault();
        suggestions[num - 1].onSelect();
        return;
      }

      if (e.key === "Enter" && suggestions[0]) {
        e.preventDefault();
        suggestions[0].onSelect();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [total, onPrev, onNext, suggestions]);

  if (total === 0) {
    return (
      <Modal onClose={onClose} maxWidth="max-w-md">
        <h3 className="pr-8 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {emptyState.title}
        </h3>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          {emptyState.message}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
        >
          Close
        </button>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <div className="flex items-center justify-between gap-2 pr-8">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {title}
        </h3>
        <span className="shrink-0 text-sm text-neutral-500">
          {currentIndex + 1} of {total}
        </span>
      </div>

      <div className="mt-4">{headline}</div>

      {context && (
        <div className="mt-4">
          <div className="mb-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Context
          </div>
          <div className="rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
            <span className="text-neutral-600 dark:text-neutral-400">
              ...{context.before}
            </span>
            <span
              className={
                context.highlightClassName ??
                "rounded bg-neutral-200 px-0.5 font-semibold dark:bg-neutral-700"
              }
            >
              {context.highlighted}
            </span>
            <span className="text-neutral-600 dark:text-neutral-400">
              {context.after}...
            </span>
          </div>
        </div>
      )}

      <div className="mt-4">
        <div className="mb-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">
          Suggestions
        </div>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.key}
              type="button"
              onClick={suggestion.onSelect}
              className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            >
              <span className="text-xs text-neutral-400">{index + 1}</span>
              {suggestion.label}
            </button>
          ))}
          {suggestions.length === 0 && (
            <span className="text-sm italic text-neutral-500">
              No suggestions available
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-700"
          >
            {action.icon && <action.icon size={14} />}
            {action.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-neutral-200 pt-3 dark:border-neutral-700">
        <button
          type="button"
          onClick={onPrev}
          disabled={total <= 1}
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
          onClick={onNext}
          disabled={total <= 1}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-700"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </Modal>
  );
}
