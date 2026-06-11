"use client";

import { AccordionSection } from "@/components/ui/AccordionSection";
import type { DerivedMetrics } from "@/lib/text-analysis";

const MIN_FONT_PX = 11;
const MAX_FONT_PX = 15;

export function WordFrequencySection({ derived }: { derived: DerivedMetrics }) {
  const { topWords } = derived;
  const max = topWords[0]?.count ?? 0;

  return (
    <AccordionSection
      title="Word frequency"
      description="Your most-used content words; articles and pronouns excluded."
      defaultOpen={false}
    >
      {topWords.length === 0 ? (
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          No content words yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {topWords.map(({ word, count }) => {
            const share = max === 0 ? 0 : count / max;
            const fontSize =
              MIN_FONT_PX + Math.round((MAX_FONT_PX - MIN_FONT_PX) * share);
            return (
              <li key={word} className="flex items-baseline justify-between">
                <span
                  className={
                    share > 0.66
                      ? "text-neutral-900 dark:text-neutral-100"
                      : share > 0.33
                        ? "text-neutral-600 dark:text-neutral-400"
                        : "text-neutral-500 dark:text-neutral-500"
                  }
                  style={{ fontSize: `${fontSize}px` }}
                >
                  {word}
                </span>
                <span className="text-[11px] tabular-nums text-neutral-400 dark:text-neutral-500">
                  {count}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </AccordionSection>
  );
}
