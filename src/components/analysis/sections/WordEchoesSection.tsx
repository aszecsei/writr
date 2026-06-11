"use client";

import { AccordionSection } from "@/components/ui/AccordionSection";
import { Badge } from "@/components/ui/Badge";
import type { Echo, EchoSeverity } from "@/lib/text-analysis";
import {
  ECHO_WINDOW_SENTENCES,
  echoProximity,
  echoSeverity,
} from "@/lib/text-analysis";
import { ChapterOnlyHint } from "./shared";

const VISIBLE_ECHOES = 10;
const VISIBLE_EXCERPTS = 2;

const SEVERITY_STYLES: Record<
  EchoSeverity,
  { label: string; badge: string; meter: string; mark: string }
> = {
  dense: {
    label: "DENSE",
    badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    meter: "bg-red-400 dark:bg-red-500",
    mark: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  },
  echo: {
    label: "ECHO",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    meter: "bg-amber-400 dark:bg-amber-500",
    mark: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  },
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Wrap occurrences of the echoed word in a tinted mark; falls back to plain
 * text when the surface form in the excerpt differs from the normal form. */
function HighlightedExcerpt({
  excerpt,
  word,
  markClassName,
}: {
  excerpt: string;
  word: string;
  markClassName: string;
}) {
  const parts = excerpt.split(
    new RegExp(`\\b(${escapeRegExp(word)})\\b`, "gi"),
  );
  return (
    <span>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark
            // biome-ignore lint/suspicious/noArrayIndexKey: alternating split parts are positional; the index is their identity
            key={`m${index}`}
            className={`rounded px-0.5 ${markClassName}`}
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </span>
  );
}

function gapCaption(minGap: number, maxGap: number): string {
  if (minGap === 0 && maxGap === 0) return "same sentence";
  if (minGap === maxGap)
    return `${minGap} ${minGap === 1 ? "sentence" : "sentences"} apart`;
  return `${minGap}–${maxGap} sentences apart`;
}

function EchoRow({ echo }: { echo: Echo }) {
  const severity = echoSeverity(echo);
  const styles = SEVERITY_STYLES[severity];
  const { minGap, maxGap } = echoProximity(echo);
  // Tighter spacing fills more of the meter.
  const proximityFill = Math.max(
    0,
    Math.min(1, 1 - minGap / ECHO_WINDOW_SENTENCES),
  );

  return (
    <li>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
          {echo.word}
        </span>
        <span className="rounded bg-neutral-100 px-1 text-[10px] font-medium tabular-nums text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          {echo.count}×
        </span>
        <span className="flex-1" />
        <Badge
          label={styles.label}
          className={`!px-1.5 !py-0 !text-[10px] tracking-wide ${styles.badge}`}
        />
      </div>
      <ul className="mt-1 space-y-0.5">
        {echo.occurrences.slice(0, VISIBLE_EXCERPTS).map((occurrence) => (
          <li
            key={`${echo.word}-${occurrence.sentenceIndex}`}
            className="text-[11px] leading-snug text-neutral-500 dark:text-neutral-400"
          >
            <HighlightedExcerpt
              excerpt={occurrence.excerpt}
              word={echo.word}
              markClassName={styles.mark}
            />
          </li>
        ))}
      </ul>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className={`h-full rounded-full ${styles.meter}`}
            style={{ width: `${proximityFill * 100}%` }}
          />
        </div>
        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
          {gapCaption(minGap, maxGap)}
        </span>
      </div>
    </li>
  );
}

export function WordEchoesSection({
  echoes,
  chapterTerm,
}: {
  /** Null at project/library scope; echoes are chapter-only by definition. */
  echoes: Echo[] | null;
  chapterTerm: string;
}) {
  return (
    <AccordionSection
      title="Word echoes"
      description='Words repeated in nearby sentences, creating an unintentional "echo" effect.'
    >
      {echoes === null ? (
        <ChapterOnlyHint what="Echoes are detected" chapterTerm={chapterTerm} />
      ) : echoes.length === 0 ? (
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          No echoes detected.
        </p>
      ) : (
        <>
          <div className="mb-2 flex items-baseline gap-2 rounded-md bg-neutral-100 px-2.5 py-2 dark:bg-neutral-900">
            <span className="text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
              {echoes.length}
            </span>
            <span className="text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
              echoed {echoes.length === 1 ? "word" : "words"} found within{" "}
              {ECHO_WINDOW_SENTENCES}-sentence proximity
            </span>
          </div>
          <ul className="space-y-3">
            {echoes.slice(0, VISIBLE_ECHOES).map((echo) => (
              <EchoRow key={echo.word} echo={echo} />
            ))}
          </ul>
        </>
      )}
    </AccordionSection>
  );
}
