"use client";

import { AccordionSection } from "@/components/ui/AccordionSection";
import type { DerivedMetrics, OpenerCategory } from "@/lib/text-analysis";
import { MeterBar } from "./shared";

const CATEGORY_LABELS: Record<OpenerCategory, string> = {
  pronoun: "Pronoun",
  noun: "Noun",
  properNoun: "Name",
  verb: "Verb",
  adverb: "Adverb",
  adjective: "Adjective",
  conjunction: "Conjunction",
  preposition: "Preposition",
  determiner: "Article/determiner",
  number: "Number",
  other: "Other",
};

const COLLAPSE_BELOW = 0.01;

export function SentenceOpenerSection({
  derived,
}: {
  derived: DerivedMetrics;
}) {
  const entries = Object.entries(derived.openerPct) as [
    OpenerCategory,
    number,
  ][];
  const major = entries
    .filter(([category, pct]) => category !== "other" && pct >= COLLAPSE_BELOW)
    .sort((a, b) => b[1] - a[1]);
  const otherPct = entries
    .filter(([category, pct]) => category === "other" || pct < COLLAPSE_BELOW)
    .reduce((sum, [, pct]) => sum + pct, 0);
  const rows: [string, number][] = [
    ...major.map(([category, pct]): [string, number] => [
      CATEGORY_LABELS[category],
      pct,
    ]),
    ...(otherPct > 0 ? [["Other", otherPct] as [string, number]] : []),
  ];

  return (
    <AccordionSection
      title="Sentence opener"
      description="Varied openings avoid a repetitive cadence."
    >
      <div className="space-y-1.5">
        {rows.map(([label, pct]) => (
          <MeterBar key={label} label={label} fraction={pct} />
        ))}
      </div>
    </AccordionSection>
  );
}
