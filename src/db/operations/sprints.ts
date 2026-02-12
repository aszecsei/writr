import { db } from "../database";
import {
  type WritingSession,
  WritingSessionSchema,
  type WritingSprint,
  WritingSprintSchema,
} from "../schemas";
import { generateId, now, toLocalDateString } from "./helpers";

// ─── Writing Sprints ────────────────────────────────────────────────

export async function getActiveSprint(): Promise<WritingSprint | undefined> {
  return db.writingSprints.where("status").anyOf(["active", "paused"]).first();
}

export async function createSprint(
  data: Pick<WritingSprint, "durationMs" | "startWordCount"> &
    Partial<Pick<WritingSprint, "projectId" | "chapterId" | "wordCountGoal">>,
): Promise<WritingSprint> {
  const existing = await getActiveSprint();
  if (existing) {
    throw new Error(
      "A sprint is already active. End it before starting a new one.",
    );
  }

  const sprint = WritingSprintSchema.parse({
    id: generateId(),
    projectId: data.projectId ?? null,
    chapterId: data.chapterId ?? null,
    durationMs: data.durationMs,
    wordCountGoal: data.wordCountGoal ?? null,
    status: "active",
    startedAt: now(),
    pausedAt: null,
    endedAt: null,
    totalPausedMs: 0,
    startWordCount: data.startWordCount,
    endWordCount: null,
    createdAt: now(),
    updatedAt: now(),
  });
  await db.writingSprints.add(sprint);
  return sprint;
}

export async function pauseSprint(id: string): Promise<void> {
  const sprint = await db.writingSprints.get(id);
  if (!sprint) throw new Error("Sprint not found.");
  if (sprint.status !== "active") throw new Error("Sprint is not active.");

  await db.writingSprints.update(id, {
    status: "paused",
    pausedAt: now(),
    updatedAt: now(),
  });
}

export async function resumeSprint(id: string): Promise<void> {
  const sprint = await db.writingSprints.get(id);
  if (!sprint) throw new Error("Sprint not found.");
  if (sprint.status !== "paused") throw new Error("Sprint is not paused.");
  if (!sprint.pausedAt) throw new Error("Sprint has no pausedAt timestamp.");

  const pausedDuration = Date.now() - new Date(sprint.pausedAt).getTime();
  await db.writingSprints.update(id, {
    status: "active",
    pausedAt: null,
    totalPausedMs: sprint.totalPausedMs + pausedDuration,
    updatedAt: now(),
  });
}

export async function endSprint(
  id: string,
  endWordCount: number,
  abandoned = false,
): Promise<void> {
  const sprint = await db.writingSprints.get(id);
  if (!sprint) throw new Error("Sprint not found.");
  if (sprint.status === "completed" || sprint.status === "abandoned") {
    throw new Error("Sprint is already ended.");
  }

  let totalPausedMs = sprint.totalPausedMs;
  if (sprint.status === "paused" && sprint.pausedAt) {
    totalPausedMs += Date.now() - new Date(sprint.pausedAt).getTime();
  }

  await db.writingSprints.update(id, {
    status: abandoned ? "abandoned" : "completed",
    endedAt: now(),
    endWordCount,
    totalPausedMs,
    pausedAt: null,
    updatedAt: now(),
  });
}

export async function getSprintsByProject(
  projectId: string | null,
  limit?: number,
): Promise<WritingSprint[]> {
  let query = projectId
    ? db.writingSprints.where({ projectId }).reverse()
    : db.writingSprints.orderBy("startedAt").reverse();

  query = query.filter(
    (s) => s.status === "completed" || s.status === "abandoned",
  );

  if (limit) {
    return query.limit(limit).toArray();
  }
  return query.toArray();
}

export async function getAllCompletedSprints(
  limit?: number,
): Promise<WritingSprint[]> {
  const query = db.writingSprints
    .orderBy("startedAt")
    .reverse()
    .filter((s) => s.status === "completed" || s.status === "abandoned");

  if (limit) {
    return query.limit(limit).toArray();
  }
  return query.toArray();
}

export async function deleteSprint(id: string): Promise<void> {
  await db.writingSprints.delete(id);
}

// ─── Writing Sessions ────────────────────────────────────────────────

// Session tracking state - tracks ongoing sessions within the same hour
const sessionCache = new Map<
  string,
  { sessionId: string; wordCountStart: number; lastUpdate: number }
>();

// How long before a session is considered stale (5 minutes)
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

/** Clears the session cache. Exported for test cleanup. */
export function clearSessionCache(): void {
  sessionCache.clear();
}

/**
 * Records a writing session for a chapter.
 * If a session exists for the same chapter in the same hour and is recent,
 * it will be extended. Otherwise, a new session is created.
 */
export async function recordWritingSession(
  projectId: string,
  chapterId: string,
  previousWordCount: number,
  newWordCount: number,
): Promise<void> {
  const timestamp = new Date();
  const date = toLocalDateString(timestamp); // YYYY-MM-DD
  const hourOfDay = timestamp.getHours();
  const cacheKey = `${chapterId}-${date}-${hourOfDay}`;

  const cached = sessionCache.get(cacheKey);
  const timeSinceLastUpdate = cached ? Date.now() - cached.lastUpdate : 0;

  if (cached && timeSinceLastUpdate < SESSION_TIMEOUT_MS) {
    // Extend existing session
    await db.writingSessions.update(cached.sessionId, {
      wordCountEnd: newWordCount,
      durationMs:
        ((await db.writingSessions.get(cached.sessionId))?.durationMs ?? 0) +
        timeSinceLastUpdate,
      updatedAt: now(),
    });
    sessionCache.set(cacheKey, {
      ...cached,
      lastUpdate: Date.now(),
    });
  } else {
    // Create new session
    const session = WritingSessionSchema.parse({
      id: generateId(),
      projectId,
      chapterId,
      date,
      hourOfDay,
      wordCountStart: previousWordCount,
      wordCountEnd: newWordCount,
      durationMs: 0,
      createdAt: now(),
      updatedAt: now(),
    });
    await db.writingSessions.add(session);
    sessionCache.set(cacheKey, {
      sessionId: session.id,
      wordCountStart: previousWordCount,
      lastUpdate: Date.now(),
    });
  }
}

export async function getSessionsByProject(
  projectId: string,
  days = 30,
): Promise<WritingSession[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = toLocalDateString(cutoffDate);

  return db.writingSessions
    .where("[projectId+date]")
    .between([projectId, cutoffStr], [projectId, "\uffff"])
    .toArray();
}

export async function getAllSessions(days = 30): Promise<WritingSession[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = toLocalDateString(cutoffDate);

  return db.writingSessions.where("date").aboveOrEqual(cutoffStr).toArray();
}
