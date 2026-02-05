"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { WritingSession } from "@/db/schemas";

export interface DailyStats {
  date: string;
  wordsWritten: number;
  sessions: number;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
}

export interface TimeOfDayStats {
  hour: number;
  wordsWritten: number;
  sessions: number;
}

export interface WritingStats {
  daily: DailyStats[];
  streak: StreakInfo;
  timeOfDay: TimeOfDayStats[];
  totalWords: number;
  averageWordsPerDay: number;
  bestHour: number | null;
}

function aggregateDailyStats(sessions: WritingSession[]): DailyStats[] {
  const byDate = new Map<string, { wordsWritten: number; sessions: number }>();

  for (const session of sessions) {
    const existing = byDate.get(session.date) ?? {
      wordsWritten: 0,
      sessions: 0,
    };
    const wordsInSession = Math.max(
      0,
      session.wordCountEnd - session.wordCountStart,
    );
    byDate.set(session.date, {
      wordsWritten: existing.wordsWritten + wordsInSession,
      sessions: existing.sessions + 1,
    });
  }

  return Array.from(byDate.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateTimeOfDayStats(sessions: WritingSession[]): TimeOfDayStats[] {
  const byHour = new Map<number, { wordsWritten: number; sessions: number }>();

  // Initialize all hours
  for (let h = 0; h < 24; h++) {
    byHour.set(h, { wordsWritten: 0, sessions: 0 });
  }

  for (const session of sessions) {
    const existing = byHour.get(session.hourOfDay);
    if (!existing) continue;
    const wordsInSession = Math.max(
      0,
      session.wordCountEnd - session.wordCountStart,
    );
    byHour.set(session.hourOfDay, {
      wordsWritten: existing.wordsWritten + wordsInSession,
      sessions: existing.sessions + 1,
    });
  }

  return Array.from(byHour.entries())
    .map(([hour, stats]) => ({ hour, ...stats }))
    .sort((a, b) => a.hour - b.hour);
}

function calculateLongestStreak(activeDays: string[]): number {
  let longest = 1;
  let currentRun = 1;

  for (let i = 1; i < activeDays.length; i++) {
    const prevDate = new Date(activeDays[i - 1]);
    const currDate = new Date(activeDays[i]);
    const diffDays = (currDate.getTime() - prevDate.getTime()) / 86400000;

    if (diffDays === 1) {
      currentRun++;
      longest = Math.max(longest, currentRun);
    } else {
      currentRun = 1;
    }
  }

  return longest;
}

function calculateCurrentStreak(
  activeDays: string[],
  today: string,
  yesterday: string,
): number {
  const lastActiveDate = activeDays[activeDays.length - 1];
  if (lastActiveDate !== today && lastActiveDate !== yesterday) return 0;

  let streak = 1;
  for (let i = activeDays.length - 2; i >= 0; i--) {
    const prevDate = new Date(activeDays[i]);
    const nextDate = new Date(activeDays[i + 1]);
    const diffDays = (nextDate.getTime() - prevDate.getTime()) / 86400000;

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function calculateStreak(dailyStats: DailyStats[]): StreakInfo {
  if (dailyStats.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: null };
  }

  const activeDays = dailyStats
    .filter((d) => d.wordsWritten > 0)
    .map((d) => d.date)
    .sort();

  if (activeDays.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: null };
  }

  const lastActiveDate = activeDays[activeDays.length - 1];
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  return {
    currentStreak: calculateCurrentStreak(activeDays, today, yesterday),
    longestStreak: calculateLongestStreak(activeDays),
    lastActiveDate,
  };
}

function findBestHour(timeOfDay: TimeOfDayStats[]): number | null {
  const best = timeOfDay.reduce<TimeOfDayStats | null>((best, curr) => {
    if (!best || curr.wordsWritten > best.wordsWritten) {
      return curr;
    }
    return best;
  }, null);

  return best && best.wordsWritten > 0 ? best.hour : null;
}

export function useWritingStats(
  projectId?: string | null,
  days = 30,
): WritingStats | undefined {
  return useLiveQuery(async () => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    let sessions: WritingSession[];
    if (projectId) {
      sessions = await db.writingSessions
        .where("[projectId+date]")
        .between([projectId, cutoffStr], [projectId, "\uffff"])
        .toArray();
    } else {
      sessions = await db.writingSessions
        .where("date")
        .aboveOrEqual(cutoffStr)
        .toArray();
    }

    const daily = aggregateDailyStats(sessions);
    const timeOfDay = aggregateTimeOfDayStats(sessions);
    const streak = calculateStreak(daily);
    const totalWords = daily.reduce((sum, d) => sum + d.wordsWritten, 0);
    const daysWithWriting = daily.filter((d) => d.wordsWritten > 0).length;
    const averageWordsPerDay =
      daysWithWriting > 0 ? Math.round(totalWords / daysWithWriting) : 0;
    const bestHour = findBestHour(timeOfDay);

    return {
      daily,
      streak,
      timeOfDay,
      totalWords,
      averageWordsPerDay,
      bestHour,
    };
  }, [projectId, days]);
}
