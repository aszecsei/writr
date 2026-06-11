"use client";

import { AccordionSection } from "@/components/ui/AccordionSection";
import type { DerivedMetrics, ParagraphSummary } from "@/lib/text-analysis";
import { type DensityLevel, paragraphDensityLevel } from "@/lib/text-analysis";
import { StatRow } from "./shared";

/** Keep the heatmap bounded on book-length scopes. */
const MAX_HEATMAP_DOTS = 600;

const DENSITY_DOT_FILL: Record<DensityLevel, string> = {
  0: "bg-primary-100 dark:bg-primary-950",
  1: "bg-primary-300 dark:bg-primary-800",
  2: "bg-primary-500 dark:bg-primary-600",
  3: "bg-primary-700 dark:bg-primary-500",
  4: "bg-primary-900 dark:bg-primary-300",
};

export function ParagraphDensitySection({
  paragraphSummaries,
  derived,
}: {
  paragraphSummaries: ParagraphSummary[];
  derived: DerivedMetrics;
}) {
  const visible = paragraphSummaries.slice(0, MAX_HEATMAP_DOTS);
  const hiddenCount = paragraphSummaries.length - visible.length;

  return (
    <AccordionSection
      title="Paragraph density"
      description="Each dot is a paragraph — the color shows how light or dense it reads."
    >
      {paragraphSummaries.length === 0 ? (
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
          No paragraphs yet.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1">
            {visible.map((paragraph, index) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: dots are positional by nature; the index is the paragraph's identity
                key={`p${index}`}
                title={`Paragraph ${index + 1} · ${paragraph.wordCount} ${
                  paragraph.wordCount === 1 ? "word" : "words"
                } · ${paragraph.sentenceCount} ${
                  paragraph.sentenceCount === 1 ? "sentence" : "sentences"
                }`}
                className={`h-3 w-3 rounded ${DENSITY_DOT_FILL[paragraphDensityLevel(paragraph)]}`}
              />
            ))}
          </div>
          {hiddenCount > 0 && (
            <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
              +{hiddenCount.toLocaleString()} more paragraphs
            </p>
          )}
        </>
      )}
      <div className="mt-2">
        <StatRow
          label="Sentences per paragraph"
          value={derived.avgSentencesPerParagraph.toFixed(1)}
        />
        <StatRow
          label="Words per paragraph"
          value={derived.avgWordsPerParagraph.toFixed(1)}
        />
      </div>
    </AccordionSection>
  );
}
