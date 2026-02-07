"use client";

import { BarChart3, Clock, TrendingUp, Type } from "lucide-react";
import { useWritingStats } from "@/hooks/useWritingStats";
import { DailyWordChart } from "./DailyWordChart";
import { StatCard } from "./StatCard";
import { StreakDisplay } from "./StreakDisplay";
import { TimeOfDayChart } from "./TimeOfDayChart";

interface WritingStatsDashboardProps {
  projectId?: string | null;
  days?: number;
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

export function WritingStatsDashboard({
  projectId,
  days = 30,
}: WritingStatsDashboardProps) {
  const stats = useWritingStats(projectId, days);

  if (!stats) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {["streak", "words", "avg", "best"].map((id) => (
            <div
              key={id}
              className="h-28 rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
            />
          ))}
        </div>
      </div>
    );
  }

  const hasData = stats.totalWords > 0;

  if (!hasData) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 p-8 text-center dark:border-neutral-800 dark:bg-neutral-900/50">
        <BarChart3 className="mx-auto mb-3 h-8 w-8 text-neutral-400 dark:text-neutral-500" />
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          No writing activity yet
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
          Start writing to see your statistics here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top row: Key stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StreakDisplay streak={stats.streak} />
        <StatCard
          label={`Words (${days} days)`}
          value={stats.totalWords.toLocaleString()}
          icon={Type}
        />
        <StatCard
          label="Avg Words/Day"
          value={stats.averageWordsPerDay.toLocaleString()}
          icon={TrendingUp}
        />
        <StatCard
          label="Best Time"
          value={stats.bestHour !== null ? formatHour(stats.bestHour) : "-"}
          icon={Clock}
          subtitle={
            stats.bestHour !== null ? "Most productive hour" : undefined
          }
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DailyWordChart daily={stats.daily} days={days} />
        <TimeOfDayChart timeOfDay={stats.timeOfDay} />
      </div>
    </div>
  );
}
