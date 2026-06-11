"use client";

import { AccordionSection } from "@/components/ui/AccordionSection";
import type { DerivedMetrics } from "@/lib/text-analysis";
import { readabilityBand } from "@/lib/text-analysis";
import { StatRow } from "./shared";

export function TextComplexitySection({
  derived,
  isAggregate,
}: {
  derived: DerivedMetrics;
  isAggregate: boolean;
}) {
  const score = derived.fleschReadingEase;
  const { ttr, rootTtr, mtld } = derived.vocabulary;

  return (
    <AccordionSection
      title="Text complexity"
      description="How demanding the prose is to read."
    >
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          {score.toFixed(0)}
        </span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {readabilityBand(score)}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500">
        Flesch reading ease, 0–100
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-full rounded-full bg-primary-500 transition-[width] duration-300"
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="mt-3">
        <StatRow label="Type–token ratio" value={ttr.toFixed(3)} />
        <StatRow label="Root TTR" value={rootTtr.toFixed(1)} />
        <StatRow
          label="MTLD"
          value={
            mtld === null
              ? "Not enough text"
              : `${isAggregate ? "≈" : ""}${mtld.toFixed(1)}`
          }
        />
      </div>
    </AccordionSection>
  );
}
