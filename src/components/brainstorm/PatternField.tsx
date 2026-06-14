"use client";

import { useState } from "react";
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";

interface PatternFieldProps {
  pattern: string;
  /** Column names available to reference, for the hint line. */
  columnNames: string[];
  /** Persist the pattern (called on blur). Mount with key={setupId}. */
  onCommit: (pattern: string) => void;
}

/** One row in the collapsible syntax reference. */
function SyntaxRow({ code, children }: { code: string; children: string }) {
  return (
    <li className="flex flex-wrap gap-x-2">
      <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
        {code}
      </code>
      <span>{children}</span>
    </li>
  );
}

/**
 * Edits the brainstorm pattern. Reference columns in square brackets, optionally
 * with a label and constraints (`[color:a]`, `[color::!a]`, `[color::a]`), and
 * wrap sometimes-clauses in `{…|p}`. Local state persists on blur.
 */
export function PatternField({
  pattern: initial,
  columnNames,
  onCommit,
}: PatternFieldProps) {
  const [pattern, setPattern] = useState(initial);

  return (
    <div>
      <AutoResizeTextarea
        label="Pattern"
        labelClassName={LABEL_CLASS}
        className={INPUT_CLASS}
        value={pattern}
        onChange={(e) => setPattern(e.target.value)}
        onBlur={() => onCommit(pattern)}
        minRows={2}
        maxRows={8}
        placeholder="There are [color:a] and [color::!a] dogs{ — mostly [size]|0.4}…"
      />
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        {columnNames.length > 0 ? (
          <>
            Reference columns in square brackets:{" "}
            {columnNames.map((name, index) => (
              <span key={name}>
                {index > 0 && ", "}
                <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
                  [{name}]
                </code>
              </span>
            ))}
          </>
        ) : (
          "Add a column above, then reference it here as [columnName]."
        )}
      </p>
      <details className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        <summary className="cursor-pointer select-none">Pattern syntax</summary>
        <ul className="mt-1 flex flex-col gap-1 pl-1">
          <SyntaxRow code="[column]">Pick a random option.</SyntaxRow>
          <SyntaxRow code="[column:a]">
            Pick and remember it as label “a”.
          </SyntaxRow>
          <SyntaxRow code="[column::a]">
            Reuse label “a”’s exact value.
          </SyntaxRow>
          <SyntaxRow code="[column::!a]">
            Pick a value different from label “a”.
          </SyntaxRow>
          <SyntaxRow code="[column::!a,!b]">
            Different from both “a” and “b”.
          </SyntaxRow>
          <SyntaxRow code="{text}">Include “text” 50% of the time.</SyntaxRow>
          <SyntaxRow code="{text|0.3}">Include it 30% of the time.</SyntaxRow>
          <SyntaxRow code="\{ \[">Escape a literal brace or bracket.</SyntaxRow>
        </ul>
      </details>
    </div>
  );
}
