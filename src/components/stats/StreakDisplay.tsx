"use client";

import { Flame } from "lucide-react";
import type { StreakInfo } from "@/hooks/editor/useWritingStats";

interface StreakDisplayProps {
  streak: StreakInfo;
}

export function StreakDisplay({ streak }: StreakDisplayProps) {
  const isActive = streak.currentStreak > 0;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 transition-all duration-150 dark:border-neutral-800 dark:bg-neutral-900">
      <div
        className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${
          isActive
            ? "bg-orange-100 text-orange-500 dark:bg-orange-900/30 dark:text-orange-400"
            : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500"
        }`}
      >
        <Flame size={16} />
      </div>
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
        Current Streak
      </p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        {streak.currentStreak} {streak.currentStreak === 1 ? "day" : "days"}
      </p>
      {streak.longestStreak > 0 && (
        <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
          Best: {streak.longestStreak} days
        </p>
      )}
    </div>
  );
}
