import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import type { ProjectId } from "@/db/schemas";
import { makeAppSettings, makeProject, resetIdCounter } from "@/test/helpers";
import {
  exportFullBackup,
  exportProject,
  gatherProjectData,
  generateBackupFilename,
} from "./export";
import {
  buildTestProjectData,
  clearAllTables,
  makeAppDictionary,
  seedProjectData,
} from "./test-helpers";
import type { FullBackup, ProjectBackup, ProjectBackupData } from "./types";
import { BACKUP_VERSION } from "./types";

beforeEach(async () => {
  resetIdCounter();
  await clearAllTables();
});

describe("gatherProjectData", () => {
  it("returns null for nonexistent project", async () => {
    const result = await gatherProjectData(crypto.randomUUID() as ProjectId);
    expect(result).toBeNull();
  });

  it("collects all entity types including projectDictionary", async () => {
    const projectId = crypto.randomUUID() as ProjectId;
    const data = buildTestProjectData(projectId);
    await seedProjectData(data);

    const gathered = await gatherProjectData(projectId);
    if (!gathered) throw new Error("Expected gathered to be non-null");
    expect(gathered.project.id).toBe(projectId);

    const arrayKeys = (
      Object.keys(data) as Array<keyof ProjectBackupData>
    ).filter((key) => Array.isArray(data[key]));
    for (const key of arrayKeys) {
      expect(gathered[key]).toHaveLength((data[key] as unknown[]).length);
    }
    expect(gathered.projectDictionary?.words).toEqual(["worldbuilding"]);
  });
});

describe("exportProject", () => {
  it("returns null for nonexistent project", async () => {
    const result = await exportProject(crypto.randomUUID() as ProjectId);
    expect(result).toBeNull();
  });

  it("creates valid ProjectBackup metadata", async () => {
    const projectId = crypto.randomUUID() as ProjectId;
    const data = buildTestProjectData(projectId);
    await db.projects.add(data.project);

    const backup = await exportProject(projectId);
    if (!backup) throw new Error("Expected backup to be non-null");
    expect(backup.metadata.version).toBe(BACKUP_VERSION);
    expect(backup.metadata.type).toBe("project");
    expect(backup.metadata.projectTitle).toBe("Test Novel");
    expect(backup.metadata.exportedAt).toBeTruthy();
  });
});

describe("exportFullBackup", () => {
  it("includes all projects + appSettings + appDictionary", async () => {
    const p1Id = crypto.randomUUID() as ProjectId;
    const p2Id = crypto.randomUUID() as ProjectId;
    await db.projects.add(makeProject({ id: p1Id, title: "Project 1" }));
    await db.projects.add(makeProject({ id: p2Id, title: "Project 2" }));
    const settings = makeAppSettings({ theme: "dark" });
    await db.appSettings.add(settings);
    const dict = makeAppDictionary({ words: ["custom"] });
    await db.appDictionary.add(dict);

    const backup = await exportFullBackup();
    expect(backup.metadata.version).toBe(BACKUP_VERSION);
    expect(backup.metadata.type).toBe("full");
    expect(backup.metadata.projectCount).toBe(2);
    expect(backup.projects).toHaveLength(2);
    expect(backup.appSettings).toBeDefined();
    expect(backup.appSettings?.theme).toBe("dark");
    expect(backup.appDictionary).toBeDefined();
    expect(backup.appDictionary?.words).toEqual(["custom"]);
  });
});

describe("generateBackupFilename", () => {
  it("produces correct filename for project backups", () => {
    const backup: ProjectBackup = {
      metadata: {
        version: BACKUP_VERSION,
        type: "project",
        exportedAt: "2024-06-15T10:00:00.000Z",
        projectTitle: "My Novel",
      },
      data: buildTestProjectData(crypto.randomUUID() as ProjectId),
    };
    const filename = generateBackupFilename(backup);
    expect(filename).toMatch(/^writr-test-novel-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it("produces correct filename for full backups", () => {
    const backup: FullBackup = {
      metadata: {
        version: BACKUP_VERSION,
        type: "full",
        exportedAt: "2024-06-15T10:00:00.000Z",
        projectCount: 0,
      },
      projects: [],
    };
    const filename = generateBackupFilename(backup);
    expect(filename).toMatch(/^writr-full-backup-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
