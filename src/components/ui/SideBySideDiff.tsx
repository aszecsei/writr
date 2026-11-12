"use client";

import { diffWordsWithSpace } from "diff";

const REMOVED_CLASS =
  "rounded-sm bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
const ADDED_CLASS =
  "rounded-sm bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";

interface SideBySideDiffProps {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
}

type Part = { key: string; value: string; className?: string };

/**
 * Two texts side by side with a word-level diff: the left column shows
 * what only `before` has, the right what only `after` has. Columns stack
 * when the container is narrow.
 */
export function SideBySideDiff({
  before,
  after,
  beforeLabel,
  afterLabel,
}: SideBySideDiffProps) {
  const left: Part[] = [];
  const right: Part[] = [];
  let offset = 0;
  for (const change of diffWordsWithSpace(before, after)) {
    const key = `${offset}`;
    offset += change.value.length;
    if (change.removed) {
      left.push({ key, value: change.value, className: REMOVED_CLASS });
    } else if (change.added) {
      right.push({ key, value: change.value, className: ADDED_CLASS });
    } else {
      left.push({ key, value: change.value });
      right.push({ key, value: change.value });
    }
  }

  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-2 @sm:grid-cols-2">
        <DiffColumn label={beforeLabel} parts={left} testId="diff-before" />
        <DiffColumn label={afterLabel} parts={right} testId="diff-after" />
      </div>
    </div>
  );
}

function DiffColumn({
  label,
  parts,
  testId,
}: {
  label: string;
  parts: Part[];
  testId: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 p-2 dark:border-neutral-800">
      <p className="mb-1 truncate text-[10px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        {label}
      </p>
      <p
        data-testid={testId}
        className="whitespace-pre-wrap text-[11px] leading-snug text-neutral-700 dark:text-neutral-300"
      >
        {parts.map((part) =>
          part.className ? (
            <span key={part.key} className={part.className}>
              {part.value}
            </span>
          ) : (
            <span key={part.key}>{part.value}</span>
          ),
        )}
      </p>
    </div>
  );
}
