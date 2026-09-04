import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import type {
  BrainstormIdeaId,
  BrainstormSetupId,
  ProjectId,
} from "@/db/schemas";
import {
  makeAppSettings,
  makeChapter,
  makeProject,
  makeSavedPrompt,
  makeScene,
  resetIdCounter,
} from "@/test/helpers";
import { exportFullBackup, exportProject } from "./export";
import { importBackup, parseBackupFile, remapProjectIds } from "./import";
import {
  buildTestProjectData,
  clearAllTables,
  makeAppDictionary,
  seedProjectData,
} from "./test-helpers";
import type { FullBackup, ProjectBackupData } from "./types";
import { BACKUP_VERSION } from "./types";

const ts = "2024-01-01T00:00:00.000Z";

beforeEach(async () => {
  resetIdCounter();
  await clearAllTables();
});

describe("remapProjectIds", () => {
  const arrayKeys = [
    "chapters",
    "characters",
    "locations",
    "characterRelationships",
    "timelineEvents",
    "styleGuideEntries",
    "guardrailEntries",
    "worldbuildingDocs",
    "outlineGridColumns",
    "outlineGridRows",
    "outlineGridCells",
    "writingSprints",
    "writingSessions",
    "playlistTracks",
    "comments",
    "chapterSnapshots",
  ] as const satisfies ReadonlyArray<keyof ProjectBackupData>;

  it("assigns new ids, rewrites projectId, and remaps cross-references for every entity", () => {
    const projectId = crypto.randomUUID() as ProjectId;
    const data = buildTestProjectData(projectId);
    const remapped = remapProjectIds(data);

    expect(remapped.project.id).not.toBe(projectId);
    expect(remapped.project.title).toBe("Test Novel (Copy)");

    for (const key of arrayKeys) {
      const original = data[key] as Array<{ id: string; projectId: string }>;
      const next = remapped[key] as Array<{ id: string; projectId: string }>;
      expect(next[0].id).not.toBe(original[0].id);
      expect(next[0].projectId).toBe(remapped.project.id);
    }
    expect(remapped.projectDictionary?.id).not.toBe(data.projectDictionary?.id);
    expect(remapped.projectDictionary?.projectId).toBe(remapped.project.id);

    const rel = remapped.characterRelationships[0];
    expect(rel.sourceCharacterId).toBe(remapped.characters[0].id);
    expect(rel.targetCharacterId).toBe(remapped.characters[1].id);
    expect(remapped.locations[0].linkedCharacterIds).toEqual([
      remapped.characters[0].id,
    ]);
    expect(remapped.timelineEvents[0].linkedChapterIds).toEqual([
      remapped.chapters[0].id,
    ]);
    expect(remapped.timelineEvents[0].linkedCharacterIds).toEqual([
      remapped.characters[0].id,
    ]);
    expect(remapped.worldbuildingDocs[0].linkedCharacterIds).toEqual([
      remapped.characters[0].id,
    ]);
    expect(remapped.worldbuildingDocs[0].linkedLocationIds).toEqual([
      remapped.locations[0].id,
    ]);
    expect(remapped.outlineGridCells[0].rowId).toBe(
      remapped.outlineGridRows[0].id,
    );
    expect(remapped.outlineGridCells[0].columnId).toBe(
      remapped.outlineGridColumns[0].id,
    );
    expect(remapped.outlineGridRows[0].linkedChapterId).toBe(
      remapped.chapters[0].id,
    );
    expect(remapped.comments[0].chapterId).toBe(remapped.chapters[0].id);
    expect(remapped.chapterSnapshots[0].chapterId).toBe(
      remapped.chapters[0].id,
    );
    expect(remapped.writingSessions[0].chapterId).toBe(remapped.chapters[0].id);
  });
});

describe("round-trip export → import", () => {
  it("produces identical data after export then import", async () => {
    const projectId = crypto.randomUUID() as ProjectId;
    const data = buildTestProjectData(projectId);
    await seedProjectData(data);

    const backup = await exportProject(projectId);
    if (!backup) throw new Error("Expected backup to be non-null");

    await clearAllTables();

    const result = await importBackup(backup, {
      conflictResolution: "skip",
      restoreSettings: false,
    });
    expect(result.success).toBe(true);
    expect(result.projectsImported).toBe(1);

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

    const guardrails = await db.guardrailEntries.where({ projectId }).toArray();
    expect(guardrails).toHaveLength(data.guardrailEntries.length);
    expect(guardrails[0].label).toBe(data.guardrailEntries[0].label);
    expect(guardrails[0].flags).toEqual(data.guardrailEntries[0].flags);

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

  it("carries scenes through an export → import round trip with remapped ids", async () => {
    const projectId = crypto.randomUUID() as ProjectId;
    const project = makeProject({ id: projectId, title: "Scene Novel" });
    const chapter = makeChapter({ projectId, title: "Chapter 1" });
    const scene1 = makeScene({
      projectId,
      chapterId: chapter.id,
      title: "Opening",
      order: 0,
    });
    const scene2 = makeScene({
      projectId,
      chapterId: chapter.id,
      title: "Twist",
      order: 1,
    });

    await db.projects.add(project);
    await db.chapters.add(chapter);
    await db.scenes.bulkAdd([scene1, scene2]);

    const backup = await exportProject(projectId);
    if (!backup) throw new Error("Expected backup to be non-null");
    expect(backup.data.scenes).toHaveLength(2);

    await clearAllTables();

    const result = await importBackup(backup, {
      conflictResolution: "skip",
      restoreSettings: false,
    });
    expect(result.success).toBe(true);
    expect(result.projectsImported).toBe(1);

    const importedChapters = await db.chapters.where({ projectId }).toArray();
    expect(importedChapters).toHaveLength(1);
    const importedChapterId = importedChapters[0].id;

    const importedScenes = await db.scenes.where({ projectId }).toArray();
    expect(importedScenes).toHaveLength(2);
    for (const scene of importedScenes) {
      expect(scene.chapterId).toBe(importedChapterId);
    }
    expect(importedScenes.map((s) => s.title).sort()).toEqual([
      "Opening",
      "Twist",
    ]);
  });

  it("imports a legacy project backup with no scenes key", async () => {
    const projectId = crypto.randomUUID() as ProjectId;
    const data = buildTestProjectData(projectId);
    const legacyData = { ...data } as Partial<ProjectBackupData>;
    legacyData.scenes = undefined;
    delete legacyData.scenes;

    const legacyBackup = {
      metadata: {
        version: BACKUP_VERSION,
        type: "project",
        exportedAt: ts,
        projectTitle: "Legacy Novel",
      },
      data: legacyData,
    };

    const parsed = parseBackupFile(JSON.stringify(legacyBackup));
    const result = await importBackup(parsed, {
      conflictResolution: "skip",
      restoreSettings: false,
    });

    expect(result.success).toBe(true);
    expect(result.projectsImported).toBe(1);

    const scenes = await db.scenes.where({ projectId }).toArray();
    expect(scenes).toHaveLength(0);
  });

  it("full backup round-trip preserves settings", async () => {
    const projectId = crypto.randomUUID() as ProjectId;
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

  it("full backup round-trip preserves global prompts and brainstorm data, and tolerates a pre-globals backup", async () => {
    const prompt = makeSavedPrompt({
      title: "Opening line",
      body: "Write a hook.",
    });
    await db.savedPrompts.add(prompt);
    const setupId = crypto.randomUUID() as BrainstormSetupId;
    await db.brainstormSetups.add({
      id: setupId,
      name: "Fantasy seeds",
      columns: [{ name: "hero", options: ["knight", "mage"] }],
      pattern: "A [hero] appears.",
      createdAt: ts,
      updatedAt: ts,
    });
    await db.brainstormIdeas.add({
      id: crypto.randomUUID() as BrainstormIdeaId,
      setupId,
      ideaText: "A weary knight stumbles into a cursed village...",
      createdAt: ts,
      updatedAt: ts,
    });

    const backup = await exportFullBackup();
    expect(backup.globals?.savedPrompts).toHaveLength(1);
    expect(backup.globals?.brainstormSetups).toHaveLength(1);
    expect(backup.globals?.brainstormIdeas).toHaveLength(1);

    await clearAllTables();

    const result = await importBackup(backup, {
      conflictResolution: "skip",
      restoreSettings: true,
    });
    expect(result.success).toBe(true);

    expect(await db.savedPrompts.get(prompt.id)).toBeDefined();
    const restoredSetup = await db.brainstormSetups.get(setupId);
    expect(restoredSetup?.name).toBe("Fantasy seeds");
    expect(restoredSetup?.columns[0].options).toEqual(["knight", "mage"]);
    expect(await db.brainstormIdeas.count()).toBe(1);

    const legacyBackup: FullBackup = { ...backup, globals: undefined };
    const legacyResult = await importBackup(legacyBackup, {
      conflictResolution: "skip",
      restoreSettings: true,
    });
    expect(legacyResult.success).toBe(true);
  });
});
