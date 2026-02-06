"use client";

import { ArrowUp, Square, X } from "lucide-react";
import type { FormEvent } from "react";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel?: () => void;
  loading: boolean;
  selectedText?: string | null;
  onClearSelection?: () => void;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  onCancel,
  loading,
  selectedText,
  onClearSelection,
}: PromptInputProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-zinc-200 p-3 dark:border-zinc-800"
    >
      {selectedText && (
        <div className="mb-2 flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          <span className="min-w-0 flex-1 truncate">
            Selection: &ldquo;{selectedText.slice(0, 80)}
            {selectedText.length > 80 ? "..." : ""}&rdquo;
          </span>
          <button
            type="button"
            onClick={onClearSelection}
            className="shrink-0 rounded p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900"
            title="Clear selection"
          >
            <X size={12} />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            selectedText ? "Ask about the selected text..." : "Ask the AI..."
          }
          disabled={loading}
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        {loading ? (
          <button
            type="button"
            onClick={onCancel}
            title="Cancel request"
            className="rounded-md bg-red-600 p-2 text-white transition-all duration-150 hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-400 dark:bg-red-500 dark:hover:bg-red-600"
          >
            <Square size={16} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            title="Send message"
            className="rounded-md bg-zinc-900 p-2 text-white transition-all duration-150 hover:bg-zinc-800 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <ArrowUp size={16} />
          </button>
        )}
      </div>
    </form>
  );
}
