"use client";

import { AccordionSection } from "@/components/ui/AccordionSection";
import type { DerivedMetrics } from "@/lib/text-analysis";
import { formatPct, StatRow } from "./shared";

// Guidance thresholds, not rules: tint the number when prose drifts past
// what most style guides consider comfortable.
const PASSIVE_WARN = 0.2;
const ADVERB_WARN = 0.06;
const GLUE_WARN = 0.45;
const STICKY_WARN = 0.25;

export function StyleFlagsSection({ derived }: { derived: DerivedMetrics }) {
  return (
    <AccordionSection
      title="Style flags"
      description="Habits worth a second look when they run high."
    >
      <StatRow
        label="Passive sentences"
        value={formatPct(derived.passivePct)}
        warn={derived.passivePct > PASSIVE_WARN}
      />
      <StatRow
        label="Adverbs"
        value={formatPct(derived.adverbPct)}
        warn={derived.adverbPct > ADVERB_WARN}
      />
      <StatRow
        label="-ly adverbs / 1,000 words"
        value={derived.lyAdverbsPer1000Words.toFixed(1)}
      />
      <StatRow
        label="Glue words"
        value={formatPct(derived.gluePct)}
        warn={derived.gluePct > GLUE_WARN}
      />
      <StatRow
        label="Sticky sentences (>40% glue)"
        value={formatPct(derived.stickyPct)}
        warn={derived.stickyPct > STICKY_WARN}
      />
    </AccordionSection>
  );
}
