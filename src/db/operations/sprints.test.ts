import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../database";
import { createChapter } from "./chapters";
import { toLocalDateString } from "./helpers";
import { createProject } from "./projects";
import {
  clearSessionCache,
  createSprint,
  endSprint,
  getActiveSprint,
  pauseSprint,
  recordWritingSession,
  resumeSprint,
} from "./sprints";

beforeEach(async () => {
  clearSessionCache();
  await db.writingSprints.clear();
  await db.writingSessions.clear();
});

describe("writing sprints", () => {
  it("prevents multiple active sprints", async () => {
    await createSprint({ durationMs: 1500000, startWordCount: 0 });

    await expect(
      createSprint({ durationMs: 1500000, startWordCount: 0 }),
    ).rejects.toThrow("A sprint is already active.");
  });

  it("prevents creating sprint when paused sprint exists", async () => {
    const sprint = await createSprint({
      durationMs: 1500000,
      startWordCount: 0,
    });
    await pauseSprint(sprint.id);

    await expect(
      createSprint({ durationMs: 1500000, startWordCount: 0 }),
    ).rejects.toThrow("A sprint is already active.");
  });

  it("allows new sprint after previous one ends", async () => {
    const sprint1 = await createSprint({
      durationMs: 1500000,
      startWordCount: 0,
    });
    await endSprint(sprint1.id, 100);

    const sprint2 = await createSprint({
      durationMs: 1500000,
      startWordCount: 100,
    });
    expect(sprint2.status).toBe("active");
  });

  it("pause and resume tracks time correctly", async () => {
    const sprint = await createSprint({
      durationMs: 1500000,
      startWordCount: 0,
    });

    await pauseSprint(sprint.id);
    const paused = await getActiveSprint();
    expect(paused?.status).toBe("paused");
    expect(paused?.pausedAt).not.toBeNull();

    await resumeSprint(sprint.id);
    const resumed = await getActiveSprint();
    expect(resumed?.status).toBe("active");
    expect(resumed?.pausedAt).toBeNull();
    expect(resumed?.totalPausedMs).toBeGreaterThanOrEqual(0);
  });

  it("end sprint captures word count", async () => {
    const sprint = await createSprint({
      durationMs: 1500000,
      startWordCount: 50,
    });
    await endSprint(sprint.id, 150);

    const ended = await db.writingSprints.get(sprint.id);
    expect(ended?.status).toBe("completed");
    expect(ended?.endWordCount).toBe(150);
    expect(ended?.endedAt).not.toBeNull();
  });

  it("end sprint with abandoned flag", async () => {
    const sprint = await createSprint({
      durationMs: 1500000,
      startWordCount: 0,
    });
    await endSprint(sprint.id, 50, true);

    const ended = await db.writingSprints.get(sprint.id);
    expect(ended?.status).toBe("abandoned");
  });
});

describe("recordWritingSession", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a session capturing word counts, chapter, and date/hour", async () => {
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    await recordWritingSession(project.id, chapter.id, 0, 100);

    const sessions = await db.writingSessions
      .where({ projectId: project.id })
      .toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].chapterId).toBe(chapter.id);
    expect(sessions[0].wordCountStart).toBe(0);
    expect(sessions[0].wordCountEnd).toBe(100);
    expect(sessions[0].durationMs).toBe(0);
    expect(sessions[0].date).toBe(toLocalDateString(new Date()));
    expect(sessions[0].hourOfDay).toBe(new Date().getHours());
  });

  it("extends the same session within the timeout window, accumulating duration and preserving the start", async () => {
    // Fake only Date — faking timers too would stall fake-indexeddb's own
    // internal scheduling.
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = new Date();
    vi.setSystemTime(start);
    const project = await createProject({ title: "P" });
    const chapter = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });

    await recordWritingSession(project.id, chapter.id, 0, 100);
    vi.setSystemTime(new Date(start.getTime() + 30_000));
    await recordWritingSession(project.id, chapter.id, 100, 150);
    vi.setSystemTime(new Date(start.getTime() + 60_000));
    await recordWritingSession(project.id, chapter.id, 150, 200);

    const sessions = await db.writingSessions
      .where({ projectId: project.id })
      .toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].wordCountStart).toBe(0);
    expect(sessions[0].wordCountEnd).toBe(200);
    expect(sessions[0].durationMs).toBe(60_000);
  });

  it("creates separate sessions for different chapters", async () => {
    const project = await createProject({ title: "P" });
    const chapter1 = await createChapter({
      projectId: project.id,
      title: "Ch1",
    });
    const chapter2 = await createChapter({
      projectId: project.id,
      title: "Ch2",
    });

    await recordWritingSession(project.id, chapter1.id, 0, 100);
    await recordWritingSession(project.id, chapter2.id, 0, 50);

    const sessions = await db.writingSessions
      .where({ projectId: project.id })
      .toArray();
    expect(sessions).toHaveLength(2);
  });
});
