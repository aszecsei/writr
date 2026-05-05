"use client";

import { useMemo, useState } from "react";
import type { Verification, VerificationFinding } from "@/db/schemas";
import { useAgentRun } from "@/hooks/data/useAgentRun";
import { useWorkUnitsByRun } from "@/hooks/data/usePlan";
import { useVerificationsByRun } from "@/hooks/data/useVerifications";

interface VerificationPanelProps {
  runId: string;
}

export function VerificationPanel({ runId }: VerificationPanelProps) {
  const run = useAgentRun(runId);
  const all = useVerificationsByRun(runId);
  const workUnits = useWorkUnitsByRun(runId);

  const tiers = useMemo(() => {
    if (!all) return [];
    const set = new Set<number>();
    for (const v of all) set.add(v.tier);
    return [...set].sort((a, b) => b - a);
  }, [all]);

  const [tier, setTier] = useState<number | null>(null);
  const activeTier = tier ?? tiers[0] ?? null;
  const filtered = (all ?? []).filter((v) => v.tier === activeTier);

  const wuName = (workUnitId: string | null): string => {
    if (!workUnitId) return "Tier-wide drift sweep";
    const wu = workUnits?.find((u) => u.id === workUnitId);
    return wu ? wu.goal : `Work unit ${workUnitId.slice(0, 8)}…`;
  };

  if (!run) return <div className="p-4 text-sm">Loading…</div>;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Verifications
        </h3>
        {tiers.length > 1 && (
          <select
            value={activeTier ?? ""}
            onChange={(e) => setTier(Number(e.target.value))}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          >
            {tiers.map((t) => (
              <option key={t} value={t}>
                Tier {t}
              </option>
            ))}
          </select>
        )}
      </header>

      {run.requiresIncrementalReread && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
          ⚠ Verifier flagged drift between the manuscript and the reader bible.
          Run an incremental Reader pass (in the Plan tab, or below) before
          planning the next tier.
        </div>
      )}

      {(!all || all.length === 0) && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No verifications yet. They run automatically after each tier is
          applied.
        </p>
      )}

      {filtered.map((v) => (
        <VerificationCard
          key={v.id}
          verification={v}
          workUnitName={wuName(v.workUnitId)}
        />
      ))}
    </div>
  );
}

function VerificationCard({
  verification,
  workUnitName,
}: {
  verification: Verification;
  workUnitName: string;
}) {
  const v = verification;
  const tierWide = v.workUnitId === null;
  const goalBadge = tierWide ? null : v.goalAchieved ? (
    <span className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-medium uppercase text-green-800 dark:bg-green-900/40 dark:text-green-200">
      Goal achieved
    </span>
  ) : (
    <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-medium uppercase text-red-800 dark:bg-red-900/40 dark:text-red-200">
      Goal MISSED
    </span>
  );

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-neutral-900 dark:text-neutral-100">
            {workUnitName}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Tier {v.tier} · {new Date(v.createdAt).toLocaleString()}
          </div>
        </div>
        {goalBadge}
      </div>

      <FindingList label="Contradictions" items={v.contradictions} tone="red" />
      <FindingList
        label="Continuity breaks"
        items={v.continuityBreaks}
        tone="amber"
      />
      <FindingList
        label="Voice mismatches"
        items={v.voiceMismatches}
        tone="blue"
      />

      {v.notes.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-neutral-600 dark:text-neutral-400">
            Verifier notes ({v.notes.length})
          </summary>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-neutral-700 dark:text-neutral-300">
            {v.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function FindingList({
  label,
  items,
  tone,
}: {
  label: string;
  items: VerificationFinding[];
  tone: "red" | "amber" | "blue";
}) {
  if (items.length === 0) return null;
  const toneClasses: Record<typeof tone, string> = {
    red: "border-red-200 bg-red-50 text-red-900 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-200",
    amber:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200",
    blue: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-200",
  };
  return (
    <div className={`mt-2 rounded-md border p-2 text-xs ${toneClasses[tone]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide">
        {label} ({items.length})
      </div>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {items.map((f) => (
          <li key={f.description}>
            {f.description}
            {f.references.length > 0 && (
              <span className="ml-2 text-[10px] opacity-70">
                ·{" "}
                {f.references
                  .map(
                    (r) =>
                      `${r.kind}:${r.id}${r.locator ? ` (${r.locator})` : ""}`,
                  )
                  .join(" · ")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
