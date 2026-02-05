"use client";

import type { TimeOfDayStats } from "@/hooks/useWritingStats";

interface TimeOfDayChartProps {
  timeOfDay: TimeOfDayStats[];
}

function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

export function TimeOfDayChart({ timeOfDay }: TimeOfDayChartProps) {
  // Reorder hours to start at 4 AM: Morning, Afternoon, Evening, Night
  const ordered = [...timeOfDay.slice(4), ...timeOfDay.slice(0, 4)];
  const maxWords = Math.max(1, ...ordered.map((t) => t.wordsWritten));

  const periods = ["Morning", "Afternoon", "Evening", "Night"];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Writing by Time of Day
      </h3>
      <div className="flex h-32 gap-1">
        {ordered.map((stat) => {
          const height =
            stat.wordsWritten > 0
              ? Math.max(4, (stat.wordsWritten / maxWords) * 100)
              : 0;
          // Color intensity based on productivity
          const intensity = stat.wordsWritten / maxWords;

          return (
            <div
              key={stat.hour}
              className="group relative flex-1 h-full flex flex-col justify-end"
              title={`${formatHour(stat.hour)}: ${stat.wordsWritten.toLocaleString()} words`}
            >
              <div
                className={`w-full rounded-t transition-all ${
                  stat.wordsWritten > 0
                    ? intensity > 0.7
                      ? "bg-emerald-500 group-hover:bg-emerald-400 dark:bg-emerald-600"
                      : intensity > 0.4
                        ? "bg-emerald-400 group-hover:bg-emerald-300 dark:bg-emerald-500"
                        : "bg-emerald-300 group-hover:bg-emerald-200 dark:bg-emerald-400"
                    : "bg-zinc-50 dark:bg-zinc-800/50"
                }`}
                style={{
                  height: `${height}%`,
                  minHeight: stat.wordsWritten > 0 ? 4 : 0,
                }}
              />
              {/* Tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-xs text-white group-hover:block dark:bg-zinc-700">
                <div className="font-medium">
                  {stat.wordsWritten.toLocaleString()} words
                </div>
                <div className="text-zinc-400">{formatHour(stat.hour)}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
        {periods.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}
