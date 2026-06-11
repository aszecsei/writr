"use client";

import { AccordionSection } from "@/components/ui/AccordionSection";
import { bucketForLength } from "@/lib/text-analysis";
import { BUCKET_FILL, ChapterOnlyHint } from "./shared";

export function SentenceRhythmSection({
  sentenceWordCounts,
  chapterTerm,
}: {
  /** Null at project/library scope, where per-sentence order is undefined. */
  sentenceWordCounts: number[] | null;
  chapterTerm: string;
}) {
  return (
    <AccordionSection
      title="Sentence rhythm"
      description="Each bar is a sentence — its height is the word count. Hover to inspect."
    >
      {sentenceWordCounts === null ? (
        <ChapterOnlyHint what="Rhythm is charted" chapterTerm={chapterTerm} />
      ) : sentenceWordCounts.length === 0 ? (
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
          No sentences yet.
        </p>
      ) : (
        <RhythmChart sentenceWordCounts={sentenceWordCounts} />
      )}
    </AccordionSection>
  );
}

function RhythmChart({ sentenceWordCounts }: { sentenceWordCounts: number[] }) {
  const max = Math.max(...sentenceWordCounts);

  return (
    <div>
      <div className="flex h-16 items-end gap-px overflow-x-auto pb-0.5">
        {sentenceWordCounts.map((wordCount, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: bars are positional by nature; the index is the sentence's identity
            key={`s${index}`}
            title={`Sentence ${index + 1} · ${wordCount} ${wordCount === 1 ? "word" : "words"}`}
            className={`w-[3px] shrink-0 rounded-t-sm ${BUCKET_FILL[bucketForLength(wordCount)]}`}
            style={{ height: `${Math.max(6, (wordCount / max) * 100)}%` }}
          />
        ))}
      </div>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-600">
        Start
      </p>
    </div>
  );
}
