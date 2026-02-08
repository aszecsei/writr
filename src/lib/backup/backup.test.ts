import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import type {
  AppDictionary,
  AppSettings,
  ChapterSnapshot,
  Comment,
  PlaylistTrack,
  ProjectDictionary,
  WritingSession,
  WritingSprint,
} from "@/db/schemas";
import { normalizeAppSettings } from "@/db/schemas";
import {
  makeChapter,
  makeCharacter,
  makeLocation,
  makeOutlineGridCell,
  makeOutlineGridColumn,
  makeOutlineGridRow,
  makeRelationship,
  makeStyleGuideEntry,
  makeTimelineEvent,
  makeWorldbuildingDoc,
  resetIdCounter,
} from "@/test/helpers";
import {
  exportFullBackup,
  exportProject,
  gatherProjectData,
  generateBackupFilename,
} from "./export";
import {
  importBackup,
  isFullBackup,
  isProjectBackup,
  parseBackupFile,
  remapProjectIds,
} from "./import";
import type {
  Backup,
  FullBackup,
  ProjectBackup,
  ProjectBackupData,
} from "./types";
import { BACKUP_VERSION } from "./types";
import { isBackupVersionSupported, validateBackup } from "./validation";

const ts = "2024-01-01T00:00:00.000Z";

function makeProject(overrides: { id: string; title: string }) {
  return {
    id: overrides.id,
    title: overrides.title,
    description: "",
    genre: "",
    targetWordCount: 0,
    createdAt: ts,
    updatedAt: ts,
  };
}

function makeComment(
  overrides: Partial<Comment> & {
    projectId: string;
    chapterId: string;
  },
): Comment {
  return {
    id: crypto.randomUUID(),
    content: "test comment",
    color: "yellow",
    fromOffset: 0,
    toOffset: 0,
    anchorText: "",
    status: "active",
    resolvedAt: null,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function makeWritingSprint(
  overrides: Partial<WritingSprint> & { projectId: string },
): WritingSprint {
  return {
    id: crypto.randomUUID(),
    chapterId: null,
    durationMs: 600000,
    wordCountGoal: null,
    status: "completed",
    startedAt: ts,
    pausedAt: null,
    endedAt: ts,
    totalPausedMs: 0,
    startWordCount: 0,
    endWordCount: null,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function makeWritingSession(
  overrides: Partial<WritingSession> & {
    projectId: string;
    chapterId: string;
  },
): WritingSession {
  return {
    id: crypto.randomUUID(),
    date: "2024-01-01",
    hourOfDay: 10,
    wordCountStart: 0,
    wordCountEnd: 100,
    durationMs: 60000,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function makePlaylistTrack(
  overrides: Partial<PlaylistTrack> & { projectId: string },
): PlaylistTrack {
  return {
    id: crypto.randomUUID(),
    title: "Test Track",
    url: "https://youtube.com/watch?v=test",
    source: "youtube",
    thumbnailUrl: "",
    duration: 180,
    order: 0,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function makeChapterSnapshot(
  overrides: Partial<ChapterSnapshot> & {
    chapterId: string;
    projectId: string;
  },
): ChapterSnapshot {
  return {
    id: crypto.randomUUID(),
    name: "Snapshot 1",
    content: "snapshot content",
    wordCount: 2,
    createdAt: ts,
    ...overrides,
  };
}

function makeAppSettings(overrides?: Partial<AppSettings>): AppSettings {
  return {
    id: "app-settings",
    enableAiFeatures: false,
    aiProvider: "openrouter",
    providerApiKeys: {
      openrouter: "",
      anthropic: "",
      openai: "",
      grok: "",
      zai: "",
    },
    providerModels: {
      openrouter: "openai/gpt-4o",
      anthropic: "claude-sonnet-4-5-20250929",
      openai: "gpt-4o",
      grok: "grok-3",
      zai: "glm-4.7",
    },
    theme: "system",
    primaryColor: "blue",
    neutralColor: "zinc",
    editorWidth: "medium",
    uiDensity: "comfortable",
    autoSaveIntervalMs: 3000,
    editorFontSize: 16,
    editorFont: "literata",
    debugMode: false,
    streamResponses: true,
    reasoningEffort: "medium",
    readingSpeedWpm: 200,
    autoFocusModeOnSprint: false,
    postChatInstructions: "",
    postChatInstructionsDepth: 2,
    assistantPrefill: "",
    customSystemPrompt: null,
    disabledBuiltinTools: [],
    builtinToolOverrides: {},
    customTools: [],
    lastExportedAt: null,
    updatedAt: ts,
    ...overrides,
  };
}

function makeAppDictionary(overrides?: Partial<AppDictionary>): AppDictionary {
  return {
    id: "app-dictionary",
    words: [],
    updatedAt: ts,
    ...overrides,
  };
}

function makeProjectDictionary(
  overrides: Partial<ProjectDictionary> & { projectId: string },
): ProjectDictionary {
  return {
    id: crypto.randomUUID(),
    words: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

/** Build a full ProjectBackupData for testing. */
function buildTestProjectData(projectId: string): ProjectBackupData {
  const chapter = makeChapter({
    projectId,
    title: "Chapter 1",
    id: crypto.randomUUID(),
  });
  const char1 = makeCharacter({
    projectId,
    name: "Hero",
    id: crypto.randomUUID(),
  });
  const char2 = makeCharacter({
    projectId,
    name: "Villain",
    id: crypto.randomUUID(),
    linkedCharacterIds: [],
  });
  const location = makeLocation({
    projectId,
    name: "Castle",
    id: crypto.randomUUID(),
    linkedCharacterIds: [char1.id],
  });
  const relationship = makeRelationship({
    projectId,
    sourceCharacterId: char1.id,
    targetCharacterId: char2.id,
    type: "custom",
    id: crypto.randomUUID(),
  });
  const timeline = makeTimelineEvent({
    projectId,
    title: "Battle",
    id: crypto.randomUUID(),
    linkedChapterIds: [chapter.id],
    linkedCharacterIds: [char1.id],
  });
  const styleGuide = makeStyleGuideEntry({
    projectId,
    title: "Rule 1",
    id: crypto.randomUUID(),
  });
  const worldDoc = makeWorldbuildingDoc({
    projectId,
    title: "Lore",
    id: crypto.randomUUID(),
    linkedCharacterIds: [char1.id],
    linkedLocationIds: [location.id],
  });
  const col = makeOutlineGridColumn({
    projectId,
    title: "Plot",
    id: crypto.randomUUID(),
  });
  const row = makeOutlineGridRow({
    projectId,
    id: crypto.randomUUID(),
    linkedChapterId: chapter.id,
  });
  const cell = makeOutlineGridCell({
    projectId,
    rowId: row.id,
    columnId: col.id,
    id: crypto.randomUUID(),
    content: "cell content",
  });
  const sprint = makeWritingSprint({ projectId });
  const session = makeWritingSession({
    projectId,
    chapterId: chapter.id,
  });
  const track = makePlaylistTrack({ projectId });
  const comment = makeComment({ projectId, chapterId: chapter.id });
  const snapshot = makeChapterSnapshot({
    projectId,
    chapterId: chapter.id,
  });
  const projectDict = makeProjectDictionary({
    projectId,
    words: ["worldbuilding"],
  });

  return {
    project: makeProject({ id: projectId, title: "Test Novel" }),
    chapters: [chapter],
    characters: [char1, char2],
    characterRelationships: [relationship],
    locations: [location],
    timelineEvents: [timeline],
    styleGuideEntries: [styleGuide],
    worldbuildingDocs: [worldDoc],
    outlineGridColumns: [col],
    outlineGridRows: [row],
    outlineGridCells: [cell],
    writingSprints: [sprint],
    writingSessions: [session],
    playlistTracks: [track],
    comments: [comment],
    chapterSnapshots: [snapshot],
    projectDictionary: projectDict,
  };
}

async function clearAllTables() {
  await db.projects.clear();
  await db.chapters.clear();
  await db.characters.clear();
  await db.characterRelationships.clear();
  await db.locations.clear();
  await db.timelineEvents.clear();
  await db.styleGuideEntries.clear();
  await db.worldbuildingDocs.clear();
  await db.outlineGridColumns.clear();
  await db.outlineGridRows.clear();
  await db.outlineGridCells.clear();
  await db.writingSprints.clear();
  await db.writingSessions.clear();
  await db.playlistTracks.clear();
  await db.comments.clear();
  await db.chapterSnapshots.clear();
  await db.projectDictionaries.clear();
  await db.appSettings.clear();
  await db.appDictionary.clear();
}

beforeEach(async () => {
  resetIdCounter();
  await clearAllTables();
});

// ─── Export ─────────────────────────────────────────────────────────

describe("gatherProjectData", () => {
  it("returns null for nonexistent project", async () => {
    const result = await gatherProjectData(crypto.randomUUID());
    expect(result).toBeNull();
  });

  it("collects all entity types including projectDictionary", async () => {
    const projectId = crypto.randomUUID();
    const data = buildTestProjectData(projectId);

    // Insert all data into the database
    await db.projects.add(data.project);
    await db.chapters.bulkAdd(data.chapters);
    await db.characters.bulkAdd(data.characters);
    await db.characterRelationships.bulkAdd(data.characterRelationships);
    await db.locations.bulkAdd(data.locations);
    await db.timelineEvents.bulkAdd(data.timelineEvents);
    await db.styleGuideEntries.bulkAdd(data.styleGuideEntries);
    await db.worldbuildingDocs.bulkAdd(data.worldbuildingDocs);
    await db.outlineGridColumns.bulkAdd(data.outlineGridColumns);
    await db.outlineGridRows.bulkAdd(data.outlineGridRows);
    await db.outlineGridCells.bulkAdd(data.outlineGridCells);
    await db.writingSprints.bulkAdd(data.writingSprints);
    await db.writingSessions.bulkAdd(data.writingSessions);
    await db.playlistTracks.bulkAdd(data.playlistTracks);
    await db.comments.bulkAdd(data.comments);
    await db.chapterSnapshots.bulkAdd(data.chapterSnapshots);
    if (data.projectDictionary) {
      await db.projectDictionaries.add(data.projectDictionary);
    }

    const gathered = await gatherProjectData(projectId);
    if (!gathered) throw new Error("Expected gathered to be non-null");
    expect(gathered.project.id).toBe(projectId);
    expect(gathered.chapters).toHaveLength(1);
    expect(gathered.characters).toHaveLength(2);
    expect(gathered.characterRelationships).toHaveLength(1);
    expect(gathered.locations).toHaveLength(1);
    expect(gathered.timelineEvents).toHaveLength(1);
    expect(gathered.styleGuideEntries).toHaveLength(1);
    expect(gathered.worldbuildingDocs).toHaveLength(1);
    expect(gathered.outlineGridColumns).toHaveLength(1);
    expect(gathered.outlineGridRows).toHaveLength(1);
    expect(gathered.outlineGridCells).toHaveLength(1);
    expect(gathered.writingSprints).toHaveLength(1);
    expect(gathered.writingSessions).toHaveLength(1);
    expect(gathered.playlistTracks).toHaveLength(1);
    expect(gathered.comments).toHaveLength(1);
    expect(gathered.chapterSnapshots).toHaveLength(1);
    expect(gathered.projectDictionary).toBeDefined();
    expect(gathered.projectDictionary?.words).toEqual(["worldbuilding"]);
  });
});

describe("exportProject", () => {
  it("returns null for nonexistent project", async () => {
    const result = await exportProject(crypto.randomUUID());
    expect(result).toBeNull();
  });

  it("creates valid ProjectBackup metadata", async () => {
    const projectId = crypto.randomUUID();
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
    const p1Id = crypto.randomUUID();
    const p2Id = crypto.randomUUID();
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
      data: buildTestProjectData(crypto.randomUUID()),
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

// ─── Validation ─────────────────────────────────────────────────────

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
    const result = validateBackup(backup);
    expect(result.success).toBe(true);
  });

  it("accepts a valid project backup", () => {
    const projectId = crypto.randomUUID();
    const backup: ProjectBackup = {
      metadata: {
        version: BACKUP_VERSION,
        type: "project",
        exportedAt: "2024-01-01T00:00:00.000Z",
        projectTitle: "Test",
      },
      data: buildTestProjectData(projectId),
    };
    const result = validateBackup(backup);
    expect(result.success).toBe(true);
  });

  it("rejects invalid data", () => {
    const result = validateBackup({ foo: "bar" });
    expect(result.success).toBe(false);
  });

  it("rejects null", () => {
    const result = validateBackup(null);
    expect(result.success).toBe(false);
  });
});

describe("normalizeAppSettings", () => {
  it("converts old API key fields to new format", () => {
    const old: Record<string, unknown> = {
      id: "app-settings",
      openRouterApiKey: "key-123",
      anthropicApiKey: "ant-456",
      preferredModel: "custom/model",
    };
    const result = normalizeAppSettings(old);
    expect(result.providerApiKeys).toEqual({
      openrouter: "key-123",
      anthropic: "ant-456",
      openai: "",
      grok: "",
      zai: "",
    });
    expect(result.providerModels).toEqual(
      expect.objectContaining({ openrouter: "custom/model" }),
    );
    expect(result.openRouterApiKey).toBeUndefined();
    expect(result.anthropicApiKey).toBeUndefined();
  });

  it("returns data unchanged if already in new format", () => {
    const data: Record<string, unknown> = {
      providerApiKeys: { openrouter: "x" },
      providerModels: { openrouter: "y" },
    };
    const result = normalizeAppSettings(data);
    expect(result).toBe(data); // same reference
  });
});

describe("isBackupVersionSupported", () => {
  it("returns true for current version", () => {
    expect(isBackupVersionSupported(BACKUP_VERSION)).toBe(true);
  });

  it("returns true for older versions", () => {
    expect(isBackupVersionSupported(1)).toBe(true);
  });

  it("returns false for future versions", () => {
    expect(isBackupVersionSupported(BACKUP_VERSION + 1)).toBe(false);
  });
});

// ─── Import ─────────────────────────────────────────────────────────

describe("parseBackupFile", () => {
  it("parses valid JSON and returns typed backup", () => {
    const backup: FullBackup = {
      metadata: {
        version: BACKUP_VERSION,
        type: "full",
        exportedAt: "2024-01-01T00:00:00.000Z",
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
        exportedAt: "2024-01-01T00:00:00.000Z",
        projectCount: 0,
      },
      projects: [],
    };
    expect(() => parseBackupFile(JSON.stringify(backup))).toThrow(
      "Unsupported backup version",
    );
  });
});

describe("isFullBackup / isProjectBackup", () => {
  it("correctly identifies full backup", () => {
    const backup: Backup = {
      metadata: {
        version: BACKUP_VERSION,
        type: "full",
        exportedAt: ts,
        projectCount: 0,
      },
      projects: [],
    } as FullBackup;
    expect(isFullBackup(backup)).toBe(true);
    expect(isProjectBackup(backup)).toBe(false);
  });

  it("correctly identifies project backup", () => {
    const backup: Backup = {
      metadata: {
        version: BACKUP_VERSION,
        type: "project",
        exportedAt: ts,
        projectTitle: "Test",
      },
      data: buildTestProjectData(crypto.randomUUID()),
    } as ProjectBackup;
    expect(isProjectBackup(backup)).toBe(true);
    expect(isFullBackup(backup)).toBe(false);
  });
});

describe("importBackup", () => {
  it("imports project data with no conflicts", async () => {
    const projectId = crypto.randomUUID();
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
    const projectId = crypto.randomUUID();
    // Pre-insert the project
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

    // Original data preserved
    const project = await db.projects.get(projectId);
    expect(project?.title).toBe("Original Title");
  });

  it("replaces existing project with 'replace' conflict resolution", async () => {
    const projectId = crypto.randomUUID();
    // Pre-insert the project with a chapter
    await db.projects.add(makeProject({ id: projectId, title: "Original" }));
    const oldChapter = makeChapter({
      projectId,
      title: "Old Chapter",
      id: crypto.randomUUID(),
    });
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

    // Old chapter should be gone, replaced with new data
    const chapters = await db.chapters.where({ projectId }).toArray();
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe("Chapter 1");
  });

  it("creates new IDs with 'duplicate' conflict resolution", async () => {
    const projectId = crypto.randomUUID();
    // Pre-insert the project
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

    // Both projects should exist
    const allProjects = await db.projects.toArray();
    expect(allProjects).toHaveLength(2);

    // The duplicated project should have "(Copy)" suffix
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
    expect(settings?.theme).toBe("light"); // unchanged
  });

  it("imports a full backup with multiple projects", async () => {
    const p1Id = crypto.randomUUID();
    const p2Id = crypto.randomUUID();
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

// ─── ID Remapping ───────────────────────────────────────────────────

describe("remapProjectIds", () => {
  it("generates new UUIDs for all entities", () => {
    const projectId = crypto.randomUUID();
    const data = buildTestProjectData(projectId);
    const remapped = remapProjectIds(data);

    // Project ID should be different
    expect(remapped.project.id).not.toBe(projectId);
    expect(remapped.project.title).toBe("Test Novel (Copy)");

    // All entity IDs should be different from originals
    expect(remapped.chapters[0].id).not.toBe(data.chapters[0].id);
    expect(remapped.characters[0].id).not.toBe(data.characters[0].id);
    expect(remapped.locations[0].id).not.toBe(data.locations[0].id);
    expect(remapped.characterRelationships[0].id).not.toBe(
      data.characterRelationships[0].id,
    );
    expect(remapped.timelineEvents[0].id).not.toBe(data.timelineEvents[0].id);
    expect(remapped.styleGuideEntries[0].id).not.toBe(
      data.styleGuideEntries[0].id,
    );
    expect(remapped.worldbuildingDocs[0].id).not.toBe(
      data.worldbuildingDocs[0].id,
    );
    expect(remapped.outlineGridColumns[0].id).not.toBe(
      data.outlineGridColumns[0].id,
    );
    expect(remapped.outlineGridRows[0].id).not.toBe(data.outlineGridRows[0].id);
    expect(remapped.outlineGridCells[0].id).not.toBe(
      data.outlineGridCells[0].id,
    );
    expect(remapped.writingSprints[0].id).not.toBe(data.writingSprints[0].id);
    expect(remapped.writingSessions[0].id).not.toBe(data.writingSessions[0].id);
    expect(remapped.playlistTracks[0].id).not.toBe(data.playlistTracks[0].id);
    expect(remapped.comments[0].id).not.toBe(data.comments[0].id);
    expect(remapped.chapterSnapshots[0].id).not.toBe(
      data.chapterSnapshots[0].id,
    );
    expect(remapped.projectDictionary?.id).not.toBe(data.projectDictionary?.id);
  });

  it("remaps all projectId fields to the new project ID", () => {
    const projectId = crypto.randomUUID();
    const data = buildTestProjectData(projectId);
    const remapped = remapProjectIds(data);

    const newProjectId = remapped.project.id;
    expect(remapped.chapters[0].projectId).toBe(newProjectId);
    expect(remapped.characters[0].projectId).toBe(newProjectId);
    expect(remapped.locations[0].projectId).toBe(newProjectId);
    expect(remapped.characterRelationships[0].projectId).toBe(newProjectId);
    expect(remapped.timelineEvents[0].projectId).toBe(newProjectId);
    expect(remapped.styleGuideEntries[0].projectId).toBe(newProjectId);
    expect(remapped.worldbuildingDocs[0].projectId).toBe(newProjectId);
    expect(remapped.outlineGridColumns[0].projectId).toBe(newProjectId);
    expect(remapped.outlineGridRows[0].projectId).toBe(newProjectId);
    expect(remapped.outlineGridCells[0].projectId).toBe(newProjectId);
    expect(remapped.writingSprints[0].projectId).toBe(newProjectId);
    expect(remapped.writingSessions[0].projectId).toBe(newProjectId);
    expect(remapped.playlistTracks[0].projectId).toBe(newProjectId);
    expect(remapped.comments[0].projectId).toBe(newProjectId);
    expect(remapped.chapterSnapshots[0].projectId).toBe(newProjectId);
    expect(remapped.projectDictionary?.projectId).toBe(newProjectId);
  });

  it("correctly remaps cross-references", () => {
    const projectId = crypto.randomUUID();
    const data = buildTestProjectData(projectId);
    const remapped = remapProjectIds(data);

    // Character relationship cross-refs
    const rel = remapped.characterRelationships[0];
    expect(rel.sourceCharacterId).toBe(remapped.characters[0].id);
    expect(rel.targetCharacterId).toBe(remapped.characters[1].id);

    // Location linked characters
    expect(remapped.locations[0].linkedCharacterIds).toEqual([
      remapped.characters[0].id,
    ]);

    // Timeline cross-refs
    expect(remapped.timelineEvents[0].linkedChapterIds).toEqual([
      remapped.chapters[0].id,
    ]);
    expect(remapped.timelineEvents[0].linkedCharacterIds).toEqual([
      remapped.characters[0].id,
    ]);

    // Worldbuilding doc cross-refs
    expect(remapped.worldbuildingDocs[0].linkedCharacterIds).toEqual([
      remapped.characters[0].id,
    ]);
    expect(remapped.worldbuildingDocs[0].linkedLocationIds).toEqual([
      remapped.locations[0].id,
    ]);

    // Outline grid cell references
    expect(remapped.outlineGridCells[0].rowId).toBe(
      remapped.outlineGridRows[0].id,
    );
    expect(remapped.outlineGridCells[0].columnId).toBe(
      remapped.outlineGridColumns[0].id,
    );

    // Outline row linked chapter
    expect(remapped.outlineGridRows[0].linkedChapterId).toBe(
      remapped.chapters[0].id,
    );

    // Comment chapter reference
    expect(remapped.comments[0].chapterId).toBe(remapped.chapters[0].id);

    // Snapshot chapter reference
    expect(remapped.chapterSnapshots[0].chapterId).toBe(
      remapped.chapters[0].id,
    );

    // Writing session chapter reference
    expect(remapped.writingSessions[0].chapterId).toBe(remapped.chapters[0].id);
  });

  it("adds (Copy) suffix to project title", () => {
    const projectId = crypto.randomUUID();
    const data = buildTestProjectData(projectId);
    const remapped = remapProjectIds(data);
    expect(remapped.project.title).toBe("Test Novel (Copy)");
  });
});

// ─── Round-trip ─────────────────────────────────────────────────────

describe("round-trip export → import", () => {
  it("produces identical data after export then import", async () => {
    const projectId = crypto.randomUUID();
    const data = buildTestProjectData(projectId);

    // Insert into DB
    await db.projects.add(data.project);
    await db.chapters.bulkAdd(data.chapters);
    await db.characters.bulkAdd(data.characters);
    await db.characterRelationships.bulkAdd(data.characterRelationships);
    await db.locations.bulkAdd(data.locations);
    await db.timelineEvents.bulkAdd(data.timelineEvents);
    await db.styleGuideEntries.bulkAdd(data.styleGuideEntries);
    await db.worldbuildingDocs.bulkAdd(data.worldbuildingDocs);
    await db.outlineGridColumns.bulkAdd(data.outlineGridColumns);
    await db.outlineGridRows.bulkAdd(data.outlineGridRows);
    await db.outlineGridCells.bulkAdd(data.outlineGridCells);
    await db.writingSprints.bulkAdd(data.writingSprints);
    await db.writingSessions.bulkAdd(data.writingSessions);
    await db.playlistTracks.bulkAdd(data.playlistTracks);
    await db.comments.bulkAdd(data.comments);
    await db.chapterSnapshots.bulkAdd(data.chapterSnapshots);
    if (data.projectDictionary) {
      await db.projectDictionaries.add(data.projectDictionary);
    }

    // Export
    const backup = await exportProject(projectId);
    if (!backup) throw new Error("Expected backup to be non-null");

    // Clear DB
    await clearAllTables();

    // Import
    const result = await importBackup(backup, {
      conflictResolution: "skip",
      restoreSettings: false,
    });
    expect(result.success).toBe(true);
    expect(result.projectsImported).toBe(1);

    // Verify all data matches
    const project = await db.projects.get(projectId);
    expect(project).toEqual(data.project);

    const chapters = await db.chapters.where({ projectId }).toArray();
    expect(chapters).toHaveLength(data.chapters.length);
    expect(chapters[0].title).toBe(data.chapters[0].title);

    const characters = await db.characters.where({ projectId }).toArray();
    expect(characters).toHaveLength(data.characters.length);

    const locations = await db.locations.where({ projectId }).toArray();
    expect(locations).toHaveLength(data.locations.length);

    const rels = await db.characterRelationships.where({ projectId }).toArray();
    expect(rels).toHaveLength(data.characterRelationships.length);

    const events = await db.timelineEvents.where({ projectId }).toArray();
    expect(events).toHaveLength(data.timelineEvents.length);

    const styleGuide = await db.styleGuideEntries
      .where({ projectId })
      .toArray();
    expect(styleGuide).toHaveLength(data.styleGuideEntries.length);

    const worldDocs = await db.worldbuildingDocs.where({ projectId }).toArray();
    expect(worldDocs).toHaveLength(data.worldbuildingDocs.length);

    const cols = await db.outlineGridColumns.where({ projectId }).toArray();
    expect(cols).toHaveLength(data.outlineGridColumns.length);

    const rows = await db.outlineGridRows.where({ projectId }).toArray();
    expect(rows).toHaveLength(data.outlineGridRows.length);

    const cells = await db.outlineGridCells.where({ projectId }).toArray();
    expect(cells).toHaveLength(data.outlineGridCells.length);

    const sprints = await db.writingSprints.where({ projectId }).toArray();
    expect(sprints).toHaveLength(data.writingSprints.length);

    const sessions = await db.writingSessions.where({ projectId }).toArray();
    expect(sessions).toHaveLength(data.writingSessions.length);

    const tracks = await db.playlistTracks.where({ projectId }).toArray();
    expect(tracks).toHaveLength(data.playlistTracks.length);

    const comments = await db.comments.where({ projectId }).toArray();
    expect(comments).toHaveLength(data.comments.length);

    const snapshots = await db.chapterSnapshots.where({ projectId }).toArray();
    expect(snapshots).toHaveLength(data.chapterSnapshots.length);

    const dict = await db.projectDictionaries.where({ projectId }).first();
    expect(dict).toBeDefined();
    expect(dict?.words).toEqual(data.projectDictionary?.words);
  });

  it("full backup round-trip preserves settings", async () => {
    const projectId = crypto.randomUUID();
    await db.projects.add(makeProject({ id: projectId, title: "My Novel" }));
    const settings = makeAppSettings({
      theme: "dark",
      primaryColor: "violet",
      editorWidth: "wide",
    });
    await db.appSettings.add(settings);
    const dict = makeAppDictionary({ words: ["foo", "bar"] });
    await db.appDictionary.add(dict);

    const backup = await exportFullBackup();

    await clearAllTables();

    const result = await importBackup(backup, {
      conflictResolution: "skip",
      restoreSettings: true,
    });

    expect(result.success).toBe(true);
    expect(result.settingsRestored).toBe(true);

    const restoredSettings = await db.appSettings.get("app-settings");
    expect(restoredSettings?.theme).toBe("dark");
    expect(restoredSettings?.primaryColor).toBe("violet");
    expect(restoredSettings?.editorWidth).toBe("wide");

    const restoredDict = await db.appDictionary.get("app-dictionary");
    expect(restoredDict?.words).toEqual(["foo", "bar"]);
  });
});
