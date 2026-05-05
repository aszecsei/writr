"use client";

import type { WorkUnit, WorkUnitStatus } from "@/db/schemas";
import { useChapter } from "@/hooks/data/useChapter";

const STATUS_LABEL: Record<WorkUnitStatus, string> = {
  planned: "Planned",
  "in-progress": "Editing",
  "awaiting-approval": "Awaiting Approval",
  approved: "Approved",
  rejected: "Rejected",
  applied: "Applied",
  superseded: "Superseded",
};

const STATUS_STYLE: Record<WorkUnitStatus, string> = {
  planned:
    "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  "in-progress":
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  "awaiting-approval":
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  approved:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  applied:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  superseded:
    "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
};

interface WorkUnitCardProps {
  unit: WorkUnit;
  /** Other work units in the same tier (used to flag chapter overlaps). */
  tierUnits: WorkUnit[];
}

export function WorkUnitCard({ unit, tierUnits }: WorkUnitCardProps) {
  const chapter = useChapter(unit.placement.chapterId);
  const conflictsWith = tierUnits.filter(
    (u) =>
      u.id !== unit.id &&
      u.placement.chapterId === unit.placement.chapterId &&
      !u.dependencies.includes(unit.id) &&
      !unit.dependencies.includes(u.id),
  );

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-neutral-900 dark:text-neutral-100">
            {unit.goal}
          </div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            <span className="font-mono">{unit.placement.position}</span>
            {" · "}
            {chapter?.title ?? unit.placement.chapterId.slice(0, 8)}
            {unit.targetLengthWords && <> · ~{unit.targetLengthWords} words</>}
          </div>
        </div>
        <span
          className={`whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLE[unit.status]}`}
        >
          {STATUS_LABEL[unit.status]}
        </span>
      </div>

      {conflictsWith.length > 0 && (
        <div className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
          ⚠ Overlaps with {conflictsWith.length} other work unit
          {conflictsWith.length === 1 ? "" : "s"} in the same chapter — they'll
          serialize via dependency edges at execution time, but consider merging
          or moving one to the next tier.
        </div>
      )}

      {unit.requiredBeats.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-neutral-600 dark:text-neutral-400">
            Required beats ({unit.requiredBeats.length})
          </summary>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-neutral-700 dark:text-neutral-300">
            {unit.requiredBeats.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ol>
        </details>
      )}

      {unit.constraints.length > 0 && (
        <details className="mt-1 text-xs">
          <summary className="cursor-pointer text-neutral-600 dark:text-neutral-400">
            Constraints ({unit.constraints.length})
          </summary>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-neutral-700 dark:text-neutral-300">
            {unit.constraints.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </details>
      )}

      {unit.bibleRefs.length > 0 && (
        <details className="mt-1 text-xs">
          <summary className="cursor-pointer text-neutral-600 dark:text-neutral-400">
            Bible refs ({unit.bibleRefs.length})
          </summary>
          <ul className="mt-1 list-disc space-y-1 pl-5 font-mono text-neutral-700 dark:text-neutral-300">
            {unit.bibleRefs.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
