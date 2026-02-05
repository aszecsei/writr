"use client";

import { ArrowUp } from "lucide-react";
import type { FormEvent } from "react";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  loading: boolean;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  loading,
}: PromptInputProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-zinc-200 p-3 dark:border-zinc-800"
    >
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ask the AI..."
          disabled={loading}
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={!value.trim() || loading}
          title="Send message"
          className="rounded-md bg-zinc-900 p-2 text-white transition-all duration-150 hover:bg-zinc-800 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <ArrowUp size={16} />
        </button>
      </div>
    </form>
  );
}
