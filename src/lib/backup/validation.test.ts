import { beforeEach, describe, expect, it } from "vitest";
import type { ProjectId } from "@/db/schemas";
import { makeChapter, makeScene, resetIdCounter } from "@/test/helpers";
import { buildTestProjectData } from "./test-helpers";
import type { FullBackup, ProjectBackup } from "./types";
import { BACKUP_VERSION } from "./types";
import { isBackupVersionSupported, validateBackup } from "./validation";

beforeEach(() => {
  resetIdCounter();
});

describe("validateBackup", () => {
  it("accepts a valid full backup", () => {
    const backup: FullBackup = {
      metadata: {
        version: BACKUP_VERSION,
        type: "full",
        exportedAt: "2024-01-01T00:00:00.000Z",
        projectCount: 0,
      },
      projects: [],
    };
    expect(validateBackup(backup).success).toBe(true);
  });

  it("accepts a valid project backup", () => {
    const projectId = crypto.randomUUID() as ProjectId;
    const backup: ProjectBackup = {
      metadata: {
        version: BACKUP_VERSION,
        type: "project",
        exportedAt: "2024-01-01T00:00:00.000Z",
        projectTitle: "Test",
      },
      data: buildTestProjectData(projectId),
    };
    expect(validateBackup(backup).success).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(validateBackup({ foo: "bar" }).success).toBe(false);
    expect(validateBackup(null).success).toBe(false);
  });

  it("keeps scenes intact when validating a project backup", () => {
    const projectId = crypto.randomUUID() as ProjectId;
    const data = buildTestProjectData(projectId);
    const chapter = makeChapter({ projectId, title: "Chapter 1" });
    const scene = makeScene({
      projectId,
      chapterId: chapter.id,
      title: "Opening",
    });
    data.chapters = [chapter];
    data.scenes = [scene];

    const backup: ProjectBackup = {
      metadata: {
        version: BACKUP_VERSION,
        type: "project",
        exportedAt: "2024-01-01T00:00:00.000Z",
        projectTitle: "Test",
      },
      data,
    };

    const result = validateBackup(backup);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const parsed = result.data as ProjectBackup;
    expect(parsed.data.scenes).toHaveLength(1);
    expect(parsed.data.scenes[0].title).toBe("Opening");
  });
});

describe("isBackupVersionSupported", () => {
  it("supports the current and older versions but not future ones", () => {
    expect(isBackupVersionSupported(BACKUP_VERSION)).toBe(true);
    expect(isBackupVersionSupported(1)).toBe(true);
    expect(isBackupVersionSupported(BACKUP_VERSION + 1)).toBe(false);
  });
});
