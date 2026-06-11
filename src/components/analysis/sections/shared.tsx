"use client";

import type { SentenceLengthBuckets } from "@/lib/text-analysis";

interface StatRowProps {
  label: string;
  value: string;
  warn?: boolean;
}

export function StatRow({ label, value, warn = false }: StatRowProps) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-xs text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <span
        className={`text-xs font-medium tabular-nums ${
          warn
            ? "text-amber-600 dark:text-amber-500"
            : "text-neutral-900 dark:text-neutral-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function formatPct(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

interface MeterBarProps {
  label: string;
  /** Supplementary gray text after the label, e.g. a word range ("1–7"). */
  range?: string;
  /** Fill share of the track, 0–1. */
  fraction: number;
  /** Tailwind background class for the fill; defaults to the primary accent. */
  fillClassName?: string;
  /** Right-aligned value text; defaults to the rounded percentage. */
  valueText?: string;
}

/** Labeled horizontal track bar: label, optional range, fill, value. */
export function MeterBar({
  label,
  range,
  fraction,
  fillClassName = "bg-primary-500",
  valueText,
}: MeterBarProps) {
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 truncate text-[11px] text-neutral-600 dark:text-neutral-400">
        {label}
        {range && (
          <span className="ml-1 text-neutral-400 dark:text-neutral-600">
            {range}
          </span>
        )}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${fillClassName}`}
          style={{ width: `${clamped * 100}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-[11px] font-medium tabular-nums text-neutral-700 dark:text-neutral-300">
        {valueText ?? `${Math.round(clamped * 100)}%`}
      </span>
    </div>
  );
}

/** Fill shades per sentence-length bucket — longer reads darker. Shared by
 * the length meters and the rhythm chart so the scales always agree. */
export const BUCKET_FILL: Record<keyof SentenceLengthBuckets, string> = {
  short: "bg-primary-300 dark:bg-primary-700",
  medium: "bg-primary-500 dark:bg-primary-500",
  long: "bg-primary-600 dark:bg-primary-400",
  veryLong: "bg-primary-800 dark:bg-primary-300",
};

/** Hint shown by chapter-scoped sections at project/library scope. */
export function ChapterOnlyHint({
  what,
  chapterTerm,
}: {
  what: string;
  chapterTerm: string;
}) {
  return (
    <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
      {what} within a single {chapterTerm} — open one to see it.
    </p>
  );
}
