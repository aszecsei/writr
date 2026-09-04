"use client";

import { AccordionSection } from "@/components/ui/AccordionSection";
import { STICKY_THRESHOLD, type StickySentence } from "@/lib/text-analysis";
import { ChapterOnlyHint, formatPct } from "./shared";

export function StickySentencesSection({
  stickySentences,
  chapterTerm,
}: {
  /** Null at project/library scope; the detail list is chapter-only. */
  stickySentences: StickySentence[] | null;
  chapterTerm: string;
}) {
  return (
    <AccordionSection
      title="Sticky sentences"
      description={`More than ${formatPct(STICKY_THRESHOLD, 0)} glue words; consider tightening.`}
      defaultOpen={false}
    >
      {stickySentences === null ? (
        <ChapterOnlyHint
          what="Sticky sentences are listed"
          chapterTerm={chapterTerm}
        />
      ) : stickySentences.length === 0 ? (
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          No sticky sentences.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {stickySentences.map((sentence) => (
            <li
              key={sentence.sentenceIndex}
              className="flex items-baseline gap-2"
            >
              <span className="shrink-0 rounded bg-amber-100 px-1 text-[10px] font-medium tabular-nums text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                {formatPct(sentence.gluePct, 0)}
              </span>
              <span className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                {sentence.excerpt}
              </span>
            </li>
          ))}
        </ul>
      )}
    </AccordionSection>
  );
}
