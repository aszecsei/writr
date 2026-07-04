"use client";

import { useState } from "react";
import { MarkdownMessage } from "@/components/ai/MarkdownMessage";
import { AutoResizeTextarea } from "./AutoResizeTextarea";

interface MarkdownFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  minRows?: number;
  /** Class for the textarea in edit mode (matches sibling form inputs). */
  className?: string;
  /** Class for the field label. */
  labelClassName?: string;
}

/**
 * Renders a markdown string as formatted prose by default, switching to an
 * editable textarea on click/focus (blur returns to the rendered view). Stays
 * controlled — edits flow out via `onChange` and are persisted by the parent
 * form, so this pairs with a batched Save button rather than saving on its own.
 */
export function MarkdownField({
  label,
  value,
  onChange,
  placeholder = "Click to add…",
  readOnly,
  minRows = 3,
  className,
  labelClassName,
}: MarkdownFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const hasValue = value.trim().length > 0;

  const labelNode = label ? (
    <span className={labelClassName}>{label}</span>
  ) : null;

  if (readOnly) {
    return (
      <div>
        {labelNode}
        <div className="mt-1">
          {hasValue ? (
            <MarkdownMessage content={value} />
          ) : (
            <span className="text-sm text-neutral-400 dark:text-neutral-500">
              —
            </span>
          )}
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div>
        {labelNode}
        <AutoResizeTextarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setIsEditing(false)}
          minRows={minRows}
          className={className}
          placeholder={placeholder}
          autoFocus
        />
      </div>
    );
  }

  return (
    <div>
      {labelNode}
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="mt-1 block w-full cursor-text rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:border-neutral-200 hover:bg-neutral-50 dark:hover:border-neutral-800 dark:hover:bg-neutral-800/50"
      >
        {hasValue ? (
          <MarkdownMessage content={value} />
        ) : (
          <span className="text-sm text-neutral-400 dark:text-neutral-500">
            {placeholder}
          </span>
        )}
      </button>
    </div>
  );
}
