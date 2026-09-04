"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { Chapter } from "@/db/schemas";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import type { RetrievalHit, RetrievalResult } from "@/lib/retrieval/types";

interface RetrievalPreviewDialogProps {
  retrieve: (
    chapter: Chapter,
    opts?: { force?: boolean },
  ) => Promise<RetrievalResult | null>;
  chapter: Chapter;
  onClose: () => void;
}

function ScoreBadge({ score }: { score: number }) {
  // Entity-linked lore comes back with score === Infinity (ENTITY_LINK_SCORE),
  // which is meaningless as a number — surface it as a distinct badge instead.
  if (!Number.isFinite(score)) {
    return (
      <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
        Entity link
      </span>
    );
  }
  return (
    <span className="inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
      {score.toFixed(3)}
    </span>
  );
}

function HitRow({ hit }: { hit: RetrievalHit }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {hit.title}
        </span>
        <ScoreBadge score={hit.score} />
        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
          chunk #{hit.chunkIndex}
        </span>
      </div>
      <pre className="mt-1.5 whitespace-pre-wrap wrap-break-word rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
        {hit.text}
      </pre>
    </div>
  );
}

function Section({
  title,
  hits,
  emptyNote,
}: {
  title: string;
  hits: RetrievalHit[];
  emptyNote?: string;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {title}
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          {hits.length}
        </span>
      </h3>
      {hits.length === 0 ? (
        <p className="text-xs italic text-neutral-400 dark:text-neutral-500">
          {emptyNote ?? "None"}
        </p>
      ) : (
        <div className="space-y-3">
          {hits.map((hit) => (
            <HitRow key={`${hit.sourceId}-${hit.chunkIndex}`} hit={hit} />
          ))}
        </div>
      )}
    </section>
  );
}

export function RetrievalPreviewDialog({
  retrieve,
  chapter,
  onClose,
}: RetrievalPreviewDialogProps) {
  const settings = useAppSettings();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RetrievalResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    retrieve(chapter, { force: true })
      .then((res) => {
        if (cancelled) return;
        setResult(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Retrieval failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retrieve, chapter]);

  const omniscient = settings?.omniscientMode ?? false;
  const isEmpty =
    result != null &&
    result.lore.length === 0 &&
    result.pastEvents.length === 0 &&
    result.futureEvents.length === 0;

  return (
    <Modal
      onClose={onClose}
      maxWidth="max-w-2xl"
      title="Retrieved Context Preview"
      description={
        <>
          What vector search would include for{" "}
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            {chapter.title}
          </span>
          .
        </>
      }
    >
      <div className="flex max-h-[85vh] flex-col">
        {settings && (
          <div className="mb-4 flex flex-wrap gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
            <span>floor {settings.similarityFloor}</span>
            <span>·</span>
            <span>lore top-{settings.loreTopK}</span>
            <span>·</span>
            <span>scene top-{settings.sceneTopK}</span>
            <span>·</span>
            <span>omniscient {omniscient ? "on" : "off"}</span>
          </div>
        )}

        {settings && !settings.loreRetrievalEnabled && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            <span>
              Retrieval is currently disabled — previewing what would be
              included if enabled.
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-neutral-500 dark:text-neutral-400">
              <Loader2 size={16} className="animate-spin" />
              Running retrieval…
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : isEmpty ? (
            <p className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
              No relevant context found.
            </p>
          ) : result ? (
            <div className="space-y-6">
              <Section title="Relevant Lore" hits={result.lore} />
              <Section title="Past Events" hits={result.pastEvents} />
              <Section
                title="Future Events"
                hits={result.futureEvents}
                emptyNote={
                  omniscient ? "None" : "Omniscient mode off — not included"
                }
              />
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
