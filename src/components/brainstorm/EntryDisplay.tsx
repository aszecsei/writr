"use client";

import { Check, Copy, Dices, FolderPlus, Save } from "lucide-react";
import type { FillResult } from "@/lib/brainstorm";

interface EntryDisplayProps {
  result: FillResult;
  onReroll: () => void;
  onCopy: () => void;
  copied: boolean;
  onSave: () => void;
  saved: boolean;
  onCreateProject: () => void;
}

/**
 * Renders a randomized entry. Successfully filled references and literal text
 * render plainly; references that matched no column (or a column with no
 * options) are left literal and flagged so the user can fix the pattern.
 */
export function EntryDisplay({
  result,
  onReroll,
  onCopy,
  copied,
  onSave,
  saved,
  onCreateProject,
}: EntryDisplayProps) {
  // Use the running character offset as a stable key — offsets are unique and
  // monotonic, avoiding array-index keys.
  let offset = 0;

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap text-base leading-relaxed text-neutral-900 dark:text-neutral-100">
        {result.segments.map((segment) => {
          const key = `${offset}:${segment.text}`;
          offset += segment.text.length;
          return segment.isUnknownColumn ? (
            <span
              key={key}
              title="No column with options matches this reference"
              className="rounded-sm bg-amber-100 px-0.5 text-amber-800 underline decoration-amber-400 decoration-dotted dark:bg-amber-900/40 dark:text-amber-300"
            >
              {segment.text}
            </span>
          ) : (
            <span key={key}>{segment.text}</span>
          );
        })}
      </p>

      {result.hasUnknown && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Highlighted references don&apos;t match a column with options — they
          were left as-is.
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onReroll}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <Dices size={16} />
          Re-roll
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy entry"}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saved}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? "Saved" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCreateProject}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <FolderPlus size={16} />
          Create project
        </button>
      </div>
    </div>
  );
}
