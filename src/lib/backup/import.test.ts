import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import type { ProjectId } from "@/db/schemas";
import {
  makeAppSettings,
  makeChapter,
  makeProject,
  resetIdCounter,
} from "@/test/helpers";
import { importBackup, isFullBackup, parseBackupFile } from "./import";
import {
  buildTestProjectData,
  clearAllTables,
  makeAppDictionary,
} from "./test-helpers";
import type { FullBackup, ProjectBackup } from "./types";
import { BACKUP_VERSION } from "./types";

const ts = "2024-01-01T00:00:00.000Z";

beforeEach(async () => {
  resetIdCounter();
  await clearAllTables();
});

describe("parseBackupFile", () => {
  it("parses valid JSON and returns typed backup", () => {
    const backup: FullBackup = {
      metadata: {
        version: BACKUP_VERSION,
        type: "full",
        exportedAt: ts,
        projectCount: 0,
      },
      projects: [],
    };
    const result = parseBackupFile(JSON.stringify(backup));
    expect(isFullBackup(result)).toBe(true);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseBackupFile("not json{")).toThrow("Invalid JSON");
  });

  it("rejects valid JSON with wrong structure", () => {
    expect(() => parseBackupFile(JSON.stringify({ foo: "bar" }))).toThrow(
      "Invalid backup format",
    );
  });

  it("rejects unsupported version", () => {
    const backup = {
      metadata: {
        version: 999,
        type: "full",
        exportedAt: ts,
        projectCount: 0,
      },
      projects: [],
    };
    expect(() => parseBackupFile(JSON.stringify(backup))).toThrow(
      "Unsupported backup version",
    );
  });
});

describe("importBackup", () => {
  it("imports project data with no conflicts", async () => {
    const projectId = crypto.randomUUID() as ProjectId;
    const data = buildTestProjectData(projectId);
    const backup: ProjectBackup = {
      metadata: {
        version: BACKUP_VERSION,
        type: "project",
        exportedAt: ts,
        projectTitle: "Test Novel",
      },
      data,
    };

    const result = await importBackup(backup, {
      conflictResolution: "skip",
      restoreSettings: false,
    });

    expect(result.success).toBe(true);
    expect(result.projectsImported).toBe(1);
    expect(result.projectsSkipped).toBe(0);

    const project = await db.projects.get(projectId);
    expect(project).toBeDefined();
    expect(project?.title).toBe("Test Novel");

    const chapters = await db.chapters.where({ projectId }).toArray();
    expect(chapters).toHaveLength(1);

    const characters = await db.characters.where({ projectId }).toArray();
    expect(characters).toHaveLength(2);
  });

  it("skips existing projects with 'skip' conflict resolution", async () => {
    const projectId = crypto.randomUUID() as ProjectId;
    await db.projects.add(
      makeProject({ id: projectId, title: "Original Title" }),
    );

    const data = buildTestProjectData(projectId);
    data.project.title = "Imported Title";
    const backup: ProjectBackup = {
      metadata: {
        version: BACKUP_VERSION,
        type: "project",
        exportedAt: ts,
      },
      data,
    };

    const result = await importBackup(backup, {
      conflictResolution: "skip",
      restoreSettings: false,
    });

    expect(result.success).toBe(true);
    expect(result.projectsImported).toBe(0);
    expect(result.projectsSkipped).toBe(1);

    const project = await db.projects.get(projectId);
    expect(project?.title).toBe("Original Title");
  });

  it("replaces existing project with 'replace' conflict resolution", async () => {
    const projectId = crypto.randomUUID() as ProjectId;
    await db.projects.add(makeProject({ id: projectId, title: "Original" }));
    const oldChapter = makeChapter({ projectId, title: "Old Chapter" });
    await db.chapters.add(oldChapter);

    const data = buildTestProjectData(projectId);
    data.project.title = "Replaced";
    const backup: ProjectBackup = {
      metadata: {
        version: BACKUP_VERSION,
        type: "project",
        exportedAt: ts,
      },
      data,
    };

    const result = await importBackup(backup, {
      conflictResolution: "replace",
      restoreSettings: false,
    });

    expect(result.success).toBe(true);
    expect(result.projectsImported).toBe(1);
    expect(result.projectsReplaced).toBe(1);

    const project = await db.projects.get(projectId);
    expect(project?.title).toBe("Replaced");

    const chapters = await db.chapters.where({ projectId }).toArray();
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe("Chapter 1");
  });

  it("creates new IDs and a '(Copy)' suffix with 'duplicate' conflict resolution", async () => {
    const projectId = crypto.randomUUID() as ProjectId;
    await db.projects.add(makeProject({ id: projectId, title: "Original" }));

    const data = buildTestProjectData(projectId);
    const backup: ProjectBackup = {
      metadata: {
        version: BACKUP_VERSION,
        type: "project",
        exportedAt: ts,
      },
      data,
    };

    const result = await importBackup(backup, {
      conflictResolution: "duplicate",
      restoreSettings: false,
    });

    expect(result.success).toBe(true);
    expect(result.projectsImported).toBe(1);

    const allProjects = await db.projects.toArray();
    expect(allProjects).toHaveLength(2);

    const titles = allProjects.map((p) => p.title);
    expect(titles).toContain("Original");
    expect(titles).toContain("Test Novel (Copy)");
  });

  it("restores appSettings when restoreSettings is true", async () => {
    const settings = makeAppSettings({ theme: "dark", primaryColor: "rose" });
    const backup: FullBackup = {
      metadata: {
        version: BACKUP_VERSION,
        type: "full",
        exportedAt: ts,
        projectCount: 0,
      },
      appSettings: settings,
      appDictionary: makeAppDictionary({ words: ["restored"] }),
      projects: [],
    };

    const result = await importBackup(backup, {
      conflictResolution: "skip",
      restoreSettings: true,
    });

    expect(result.success).toBe(true);
    expect(result.settingsRestored).toBe(true);

    const restored = await db.appSettings.get("app-settings");
    expect(restored).toBeDefined();
    expect(restored?.theme).toBe("dark");
    expect(restored?.primaryColor).toBe("rose");

    const dict = await db.appDictionary.get("app-dictionary");
    expect(dict).toBeDefined();
    expect(dict?.words).toEqual(["restored"]);
  });

  it("does NOT restore settings when restoreSettings is false", async () => {
    const existingSettings = makeAppSettings({ theme: "light" });
    await db.appSettings.add(existingSettings);

    const backup: FullBackup = {
      metadata: {
        version: BACKUP_VERSION,
        type: "full",
        exportedAt: ts,
        projectCount: 0,
      },
      appSettings: makeAppSettings({ theme: "dark" }),
      projects: [],
    };

    const result = await importBackup(backup, {
      conflictResolution: "skip",
      restoreSettings: false,
    });

    expect(result.success).toBe(true);
    expect(result.settingsRestored).toBe(false);

    const settings = await db.appSettings.get("app-settings");
    expect(settings?.theme).toBe("light");
  });

  it("imports a full backup with multiple projects", async () => {
    const p1Id = crypto.randomUUID() as ProjectId;
    const p2Id = crypto.randomUUID() as ProjectId;
    const backup: FullBackup = {
      metadata: {
        version: BACKUP_VERSION,
        type: "full",
        exportedAt: ts,
        projectCount: 2,
      },
      projects: [buildTestProjectData(p1Id), buildTestProjectData(p2Id)],
    };
    backup.projects[0].project.title = "Novel A";
    backup.projects[1].project.title = "Novel B";

    const result = await importBackup(backup, {
      conflictResolution: "skip",
      restoreSettings: false,
    });

    expect(result.success).toBe(true);
    expect(result.projectsImported).toBe(2);

    const allProjects = await db.projects.toArray();
    expect(allProjects).toHaveLength(2);
  });
});
