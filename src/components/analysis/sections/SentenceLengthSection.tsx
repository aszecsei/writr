"use client";

import { AccordionSection } from "@/components/ui/AccordionSection";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import type { AnalysisCounts, DerivedMetrics } from "@/lib/text-analysis";
import { LONG_MAX, MEDIUM_MAX, SHORT_MAX } from "@/lib/text-analysis";
import { useUiStore } from "@/store/uiStore";
import { BUCKET_FILL, MeterBar, StatRow } from "./shared";

const BUCKETS = [
  { key: "short", label: "Short", range: `1–${SHORT_MAX}` },
  { key: "medium", label: "Medium", range: `${SHORT_MAX + 1}–${MEDIUM_MAX}` },
  { key: "long", label: "Long", range: `${MEDIUM_MAX + 1}–${LONG_MAX}` },
  { key: "veryLong", label: "Very long", range: `${LONG_MAX + 1}+` },
] as const;

export function SentenceLengthSection({
  counts,
  derived,
}: {
  counts: AnalysisCounts;
  derived: DerivedMetrics;
}) {
  const previewEnabled = useUiStore((s) => s.sentenceLengthPreviewEnabled);
  const setSentenceLengthPreview = useUiStore(
    (s) => s.setSentenceLengthPreview,
  );
  const total = counts.sentences;

  return (
    <AccordionSection
      title="Sentence length"
      description="How your sentences break down by word count."
    >
      <div className="space-y-1.5">
        {BUCKETS.map(({ key, label, range }) => (
          <MeterBar
            key={key}
            label={label}
            range={range}
            fraction={
              total === 0 ? 0 : counts.sentenceLengthBuckets[key] / total
            }
            fillClassName={BUCKET_FILL[key]}
          />
        ))}
      </div>
      <div className="mt-2">
        <StatRow
          label="Average length"
          value={`${derived.avgSentenceLength.toFixed(1)} words`}
        />
        <StatRow
          label="Variation (std dev)"
          value={derived.sentenceLengthStdDev.toFixed(1)}
        />
      </div>
      <div className="mt-2 rounded-md bg-neutral-100 px-2.5 py-2 dark:bg-neutral-900">
        <ToggleSwitch
          checked={previewEnabled}
          onChange={setSentenceLengthPreview}
          label="Preview"
          caption="Highlight sentences in the editor by length"
        />
      </div>
    </AccordionSection>
  );
}
