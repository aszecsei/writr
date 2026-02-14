import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WritingSession } from "@/db/schemas";
import {
  aggregateDailyStats,
  aggregateTimeOfDayStats,
  calculateCurrentStreak,
  calculateLongestStreak,
  calculateStreak,
  type DailyStats,
  findBestHour,
  type TimeOfDayStats,
} from "./useWritingStats";

const ts = "2024-01-01T00:00:00.000Z";

function makeSession(
  overrides: Partial<WritingSession> & {
    date: string;
    wordCountStart: number;
    wordCountEnd: number;
  },
): WritingSession {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    projectId: "00000000-0000-4000-8000-000000000010",
    chapterId: "00000000-0000-4000-8000-000000000020",
    hourOfDay: 10,
    durationMs: 60000,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

// ─── aggregateDailyStats ──────────────────────────────────────────────

describe("aggregateDailyStats", () => {
  it("returns empty array for no sessions", () => {
    expect(aggregateDailyStats([])).toEqual([]);
  });

  it("accumulates sessions on the same date", () => {
    const sessions = [
      makeSession({ date: "2024-01-01", wordCountStart: 0, wordCountEnd: 100 }),
      makeSession({
        date: "2024-01-01",
        wordCountStart: 100,
        wordCountEnd: 250,
      }),
    ];
    const result = aggregateDailyStats(sessions);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      date: "2024-01-01",
      wordsWritten: 250,
      sessions: 2,
    });
  });

  it("sorts results by date", () => {
    const sessions = [
      makeSession({ date: "2024-01-03", wordCountStart: 0, wordCountEnd: 10 }),
      makeSession({ date: "2024-01-01", wordCountStart: 0, wordCountEnd: 20 }),
      makeSession({ date: "2024-01-02", wordCountStart: 0, wordCountEnd: 30 }),
    ];
    const result = aggregateDailyStats(sessions);
    expect(result.map((d) => d.date)).toEqual([
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
    ]);
  });

  it("clamps negative word delta to 0", () => {
    const sessions = [
      makeSession({
        date: "2024-01-01",
        wordCountStart: 100,
        wordCountEnd: 50,
      }),
    ];
    const result = aggregateDailyStats(sessions);
    expect(result[0].wordsWritten).toBe(0);
  });
});

// ─── aggregateTimeOfDayStats ──────────────────────────────────────────

describe("aggregateTimeOfDayStats", () => {
  it("returns 24 entries for empty sessions", () => {
    const result = aggregateTimeOfDayStats([]);
    expect(result).toHaveLength(24);
    expect(result.every((h) => h.wordsWritten === 0 && h.sessions === 0)).toBe(
      true,
    );
  });

  it("accumulates words by hour", () => {
    const sessions = [
      makeSession({
        date: "2024-01-01",
        hourOfDay: 14,
        wordCountStart: 0,
        wordCountEnd: 200,
      }),
      makeSession({
        date: "2024-01-02",
        hourOfDay: 14,
        wordCountStart: 0,
        wordCountEnd: 100,
      }),
    ];
    const result = aggregateTimeOfDayStats(sessions);
    const hour14 = result.find((h) => h.hour === 14);
    expect(hour14).toEqual({ hour: 14, wordsWritten: 300, sessions: 2 });
  });

  it("skips sessions with invalid hourOfDay", () => {
    const sessions = [
      makeSession({
        date: "2024-01-01",
        hourOfDay: 25 as number,
        wordCountStart: 0,
        wordCountEnd: 100,
      }),
    ];
    const result = aggregateTimeOfDayStats(sessions);
    expect(result.every((h) => h.sessions === 0)).toBe(true);
  });
});

// ─── calculateLongestStreak ──────────────────────────────────────────

describe("calculateLongestStreak", () => {
  it("returns 1 for a single day", () => {
    expect(calculateLongestStreak(["2024-01-01"])).toBe(1);
  });

  it("counts consecutive days", () => {
    expect(
      calculateLongestStreak(["2024-01-01", "2024-01-02", "2024-01-03"]),
    ).toBe(3);
  });

  it("finds the longest run with gaps", () => {
    const days = [
      "2024-01-01",
      "2024-01-02",
      "2024-01-05",
      "2024-01-06",
      "2024-01-07",
    ];
    expect(calculateLongestStreak(days)).toBe(3);
  });

  it("returns 1 when no consecutive days exist", () => {
    expect(
      calculateLongestStreak(["2024-01-01", "2024-01-03", "2024-01-05"]),
    ).toBe(1);
  });
});

// ─── calculateCurrentStreak ──────────────────────────────────────────

describe("calculateCurrentStreak", () => {
  it("returns 0 when last active is stale", () => {
    expect(
      calculateCurrentStreak(["2024-01-01"], "2024-01-10", "2024-01-09"),
    ).toBe(0);
  });

  it("returns 1 for today only", () => {
    expect(
      calculateCurrentStreak(["2024-01-10"], "2024-01-10", "2024-01-09"),
    ).toBe(1);
  });

  it("counts consecutive days ending today", () => {
    const days = ["2024-01-08", "2024-01-09", "2024-01-10"];
    expect(calculateCurrentStreak(days, "2024-01-10", "2024-01-09")).toBe(3);
  });

  it("counts consecutive days ending yesterday", () => {
    const days = ["2024-01-08", "2024-01-09"];
    expect(calculateCurrentStreak(days, "2024-01-10", "2024-01-09")).toBe(2);
  });

  it("breaks streak on gap", () => {
    const days = ["2024-01-05", "2024-01-08", "2024-01-09", "2024-01-10"];
    expect(calculateCurrentStreak(days, "2024-01-10", "2024-01-09")).toBe(3);
  });
});

// ─── calculateStreak ────────────────────────────────────────────────

describe("calculateStreak", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns zeros for empty daily stats", () => {
    expect(calculateStreak([])).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
    });
  });

  it("returns zeros when all days have zero words", () => {
    const daily: DailyStats[] = [
      { date: "2024-01-01", wordsWritten: 0, sessions: 1 },
      { date: "2024-01-02", wordsWritten: 0, sessions: 2 },
    ];
    expect(calculateStreak(daily)).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
    });
  });

  it("computes correct streaks with faked time", () => {
    vi.setSystemTime(new Date("2024-01-05T12:00:00Z"));
    const daily: DailyStats[] = [
      { date: "2024-01-03", wordsWritten: 100, sessions: 1 },
      { date: "2024-01-04", wordsWritten: 200, sessions: 1 },
      { date: "2024-01-05", wordsWritten: 50, sessions: 1 },
    ];
    const result = calculateStreak(daily);
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
    expect(result.lastActiveDate).toBe("2024-01-05");
  });
});

// ─── findBestHour ───────────────────────────────────────────────────

describe("findBestHour", () => {
  it("returns null for empty array", () => {
    expect(findBestHour([])).toBeNull();
  });

  it("returns null when all hours have zero words", () => {
    const stats: TimeOfDayStats[] = [
      { hour: 0, wordsWritten: 0, sessions: 0 },
      { hour: 1, wordsWritten: 0, sessions: 0 },
    ];
    expect(findBestHour(stats)).toBeNull();
  });

  it("returns the hour with the most words", () => {
    const stats: TimeOfDayStats[] = [
      { hour: 8, wordsWritten: 100, sessions: 2 },
      { hour: 14, wordsWritten: 500, sessions: 3 },
      { hour: 22, wordsWritten: 200, sessions: 1 },
    ];
    expect(findBestHour(stats)).toBe(14);
  });
});
