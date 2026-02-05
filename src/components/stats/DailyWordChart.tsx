"use client";

import type { DailyStats } from "@/hooks/useWritingStats";

interface DailyWordChartProps {
  daily: DailyStats[];
  days?: number;
}

export function DailyWordChart({ daily, days = 30 }: DailyWordChartProps) {
  // Fill in missing days with zero values
  const today = new Date();
  const filledData: DailyStats[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    const existing = daily.find((d) => d.date === dateStr);
    filledData.push(
      existing ?? { date: dateStr, wordsWritten: 0, sessions: 0 },
    );
  }

  const maxWords = Math.max(1, ...filledData.map((d) => d.wordsWritten));

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Daily Words (Last {days} Days)
      </h3>
      <div className="flex h-32 items-end gap-[2px]">
        {filledData.map((day) => {
          const height =
            day.wordsWritten > 0
              ? Math.max(4, (day.wordsWritten / maxWords) * 100)
              : 0;
          const date = new Date(day.date);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;

          return (
            <div
              key={day.date}
              className="group relative flex-1 h-full flex flex-col justify-end"
              title={`${day.date}: ${day.wordsWritten.toLocaleString()} words`}
            >
              <div
                className={`w-full rounded-t transition-all ${
                  day.wordsWritten > 0
                    ? "bg-blue-500 group-hover:bg-blue-400 dark:bg-blue-600 dark:group-hover:bg-blue-500"
                    : isWeekend
                      ? "bg-zinc-100 dark:bg-zinc-800"
                      : "bg-zinc-50 dark:bg-zinc-800/50"
                }`}
                style={{
                  height: `${height}%`,
                  minHeight: day.wordsWritten > 0 ? 4 : 0,
                }}
              />
              {/* Tooltip on hover */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded bg-zinc-900 px-2 py-1 text-xs text-white group-hover:block dark:bg-zinc-700">
                <div className="font-medium">
                  {day.wordsWritten.toLocaleString()}
                </div>
                <div className="text-zinc-400">
                  {date.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
        <span>
          {new Date(today.getTime() - (days - 1) * 86400000).toLocaleDateString(
            undefined,
            {
              month: "short",
              day: "numeric",
            },
          )}
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}
