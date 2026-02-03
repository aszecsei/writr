"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { db } from "@/db/database";
import type { WritingSprint } from "@/db/schemas";

export function useSprintHistory(projectId?: string | null, limit = 50) {
  return useLiveQuery(async () => {
    let query = db.writingSprints
      .orderBy("startedAt")
      .reverse()
      .filter((s) => s.status === "completed" || s.status === "abandoned");

    if (projectId) {
      query = query.filter((s) => s.projectId === projectId);
    }

    return query.limit(limit).toArray();
  }, [projectId, limit]);
}

export interface SprintStats {
  totalSprints: number;
  completedSprints: number;
  abandonedSprints: number;
  totalWordsWritten: number;
  totalTimeMs: number;
  averageWordsPerSprint: number;
  averageWpm: number;
}

function calculateStats(sprints: WritingSprint[]): SprintStats {
  const completed = sprints.filter((s) => s.status === "completed");
  const abandoned = sprints.filter((s) => s.status === "abandoned");

  let totalWords = 0;
  let totalTimeMs = 0;

  for (const sprint of sprints) {
    if (sprint.endWordCount !== null) {
      const words = sprint.endWordCount - sprint.startWordCount;
      totalWords += Math.max(0, words);
    }

    if (sprint.endedAt && sprint.startedAt) {
      const duration =
        new Date(sprint.endedAt).getTime() -
        new Date(sprint.startedAt).getTime() -
        sprint.totalPausedMs;
      totalTimeMs += Math.max(0, duration);
    }
  }

  const avgWords =
    sprints.length > 0 ? Math.round(totalWords / sprints.length) : 0;
  const avgWpm =
    totalTimeMs > 0 ? Math.round((totalWords / totalTimeMs) * 60000) : 0;

  return {
    totalSprints: sprints.length,
    completedSprints: completed.length,
    abandonedSprints: abandoned.length,
    totalWordsWritten: totalWords,
    totalTimeMs,
    averageWordsPerSprint: avgWords,
    averageWpm: avgWpm,
  };
}

export function useSprintStats(projectId?: string | null) {
  const sprints = useSprintHistory(projectId, 1000);

  return useMemo(() => {
    if (!sprints) return undefined;
    return calculateStats(sprints);
  }, [sprints]);
}
