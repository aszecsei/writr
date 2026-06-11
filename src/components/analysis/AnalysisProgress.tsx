"use client";

interface AnalysisProgressProps {
  done: number;
  total: number;
}

export function AnalysisProgress({ done, total }: AnalysisProgressProps) {
  const share = total === 0 ? 0 : done / total;
  return (
    <div className="px-3 py-2">
      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
        Analyzing {done} / {total} {total === 1 ? "document" : "documents"}…
      </p>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div
          className="h-full rounded-full bg-primary-500 transition-[width] duration-300"
          style={{ width: `${share * 100}%` }}
        />
      </div>
    </div>
  );
}
