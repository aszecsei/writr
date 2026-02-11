import { db } from "@/db/database";
import { deleteAllProjectData } from "@/db/operations/projects";
import { generateId } from "@/lib/id";
import type {
  Backup,
  FullBackup,
  ImportOptions,
  ImportResult,
  ProjectBackup,
  ProjectBackupData,
} from "./types";
import { isBackupVersionSupported, validateBackup } from "./validation";

export function parseBackupFile(content: string): Backup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Invalid JSON: Unable to parse backup file");
  }

  const result = validateBackup(parsed);
  if (!result.success) {
    const errors = result.error.issues
      .map((issue: { message: string }) => issue.message)
      .join(", ");
    throw new Error(`Invalid backup format: ${errors}`);
  }

  if (!isBackupVersionSupported(result.data.metadata.version)) {
    throw new Error(
      `Unsupported backup version: ${result.data.metadata.version}. Please update the app.`,
    );
  }

  return result.data;
}

export function isFullBackup(backup: Backup): backup is FullBackup {
  return backup.metadata.type === "full";
}

export function isProjectBackup(backup: Backup): backup is ProjectBackup {
  return backup.metadata.type === "project";
}

type IdMap = Map<string, string>;

function remapId(id: string | null | undefined, idMap: IdMap): string | null {
  if (id == null) return null;
  return idMap.get(id) ?? id;
}

function remapIdArray(ids: string[] | undefined, idMap: IdMap): string[] {
  if (!ids) return [];
  return ids.map((id) => idMap.get(id) ?? id);
}

function mustGetId(idMap: IdMap, oldId: string): string {
  const newId = idMap.get(oldId);
  if (!newId) {
    throw new Error(`ID mapping not found for: ${oldId}`);
  }
  return newId;
}

function mapEntityIds(idMap: IdMap, entities: { id: string }[]): void {
  for (const entity of entities) {
    idMap.set(entity.id, generateId());
  }
}

export function remapProjectIds(data: ProjectBackupData): ProjectBackupData {
  const idMap: IdMap = new Map();

  // Generate new IDs for all entities
  const newProjectId = generateId();
  idMap.set(data.project.id, newProjectId);

  mapEntityIds(idMap, data.chapters);
  mapEntityIds(idMap, data.characters);
  mapEntityIds(idMap, data.characterRelationships);
  mapEntityIds(idMap, data.locations);
  mapEntityIds(idMap, data.timelineEvents);
  mapEntityIds(idMap, data.styleGuideEntries);
  mapEntityIds(idMap, data.worldbuildingDocs);
  mapEntityIds(idMap, data.outlineGridColumns);
  mapEntityIds(idMap, data.outlineGridRows);
  mapEntityIds(idMap, data.outlineGridCells);
  mapEntityIds(idMap, data.writingSprints);
  mapEntityIds(idMap, data.writingSessions);
  mapEntityIds(idMap, data.playlistTracks);
  mapEntityIds(idMap, data.comments);
  mapEntityIds(idMap, data.chapterSnapshots);
  if (data.projectDictionary) {
    idMap.set(data.projectDictionary.id, generateId());
  }

  // Remap project
  const project = {
    ...data.project,
    id: newProjectId,
    title: `${data.project.title} (Copy)`,
  };

  // Remap chapters
  const chapters = data.chapters.map((c) => ({
    ...c,
    id: mustGetId(idMap, c.id),
    projectId: newProjectId,
  }));

  // Remap characters with cross-references
  const characters = data.characters.map((c) => ({
    ...c,
    id: mustGetId(idMap, c.id),
    projectId: newProjectId,
    linkedCharacterIds: remapIdArray(c.linkedCharacterIds, idMap),
    linkedLocationIds: remapIdArray(c.linkedLocationIds, idMap),
  }));

  // Remap character relationships
  const characterRelationships = data.characterRelationships.map((r) => ({
    ...r,
    id: mustGetId(idMap, r.id),
    projectId: newProjectId,
    sourceCharacterId: mustGetId(idMap, r.sourceCharacterId),
    targetCharacterId: mustGetId(idMap, r.targetCharacterId),
  }));

  // Remap locations with parent references
  const locations = data.locations.map((l) => ({
    ...l,
    id: mustGetId(idMap, l.id),
    projectId: newProjectId,
    parentLocationId: remapId(l.parentLocationId, idMap),
    linkedCharacterIds: remapIdArray(l.linkedCharacterIds, idMap),
  }));

  // Remap timeline events
  const timelineEvents = data.timelineEvents.map((e) => ({
    ...e,
    id: mustGetId(idMap, e.id),
    projectId: newProjectId,
    linkedChapterIds: remapIdArray(e.linkedChapterIds, idMap),
    linkedCharacterIds: remapIdArray(e.linkedCharacterIds, idMap),
  }));

  // Remap style guide entries
  const styleGuideEntries = data.styleGuideEntries.map((s) => ({
    ...s,
    id: mustGetId(idMap, s.id),
    projectId: newProjectId,
  }));

  // Remap worldbuilding docs with parent references
  const worldbuildingDocs = data.worldbuildingDocs.map((d) => ({
    ...d,
    id: mustGetId(idMap, d.id),
    projectId: newProjectId,
    parentDocId: remapId(d.parentDocId, idMap),
    linkedCharacterIds: remapIdArray(d.linkedCharacterIds, idMap),
    linkedLocationIds: remapIdArray(d.linkedLocationIds, idMap),
  }));

  // Remap outline grid
  const outlineGridColumns = data.outlineGridColumns.map((c) => ({
    ...c,
    id: mustGetId(idMap, c.id),
    projectId: newProjectId,
  }));

  const outlineGridRows = data.outlineGridRows.map((r) => ({
    ...r,
    id: mustGetId(idMap, r.id),
    projectId: newProjectId,
    linkedChapterId: remapId(r.linkedChapterId, idMap),
  }));

  const outlineGridCells = data.outlineGridCells.map((c) => ({
    ...c,
    id: mustGetId(idMap, c.id),
    projectId: newProjectId,
    rowId: mustGetId(idMap, c.rowId),
    columnId: mustGetId(idMap, c.columnId),
  }));

  // Remap writing sprints
  const writingSprints = data.writingSprints.map((s) => ({
    ...s,
    id: mustGetId(idMap, s.id),
    projectId: newProjectId,
    chapterId: remapId(s.chapterId, idMap),
  }));

  // Remap writing sessions
  const writingSessions = data.writingSessions.map((s) => ({
    ...s,
    id: mustGetId(idMap, s.id),
    projectId: newProjectId,
    chapterId: mustGetId(idMap, s.chapterId),
  }));

  // Remap playlist tracks
  const playlistTracks = data.playlistTracks.map((t) => ({
    ...t,
    id: mustGetId(idMap, t.id),
    projectId: newProjectId,
  }));

  // Remap comments
  const comments = data.comments.map((c) => ({
    ...c,
    id: mustGetId(idMap, c.id),
    projectId: newProjectId,
    chapterId: mustGetId(idMap, c.chapterId),
  }));

  // Remap chapter snapshots
  const chapterSnapshots = data.chapterSnapshots.map((s) => ({
    ...s,
    id: mustGetId(idMap, s.id),
    chapterId: mustGetId(idMap, s.chapterId),
    projectId: newProjectId,
  }));

  // Remap project dictionary
  const projectDictionary = data.projectDictionary
    ? {
        ...data.projectDictionary,
        id: mustGetId(idMap, data.projectDictionary.id),
        projectId: newProjectId,
      }
    : undefined;

  return {
    project,
    chapters,
    characters,
    characterRelationships,
    locations,
    timelineEvents,
    styleGuideEntries,
    worldbuildingDocs,
    outlineGridColumns,
    outlineGridRows,
    outlineGridCells,
    writingSprints,
    writingSessions,
    playlistTracks,
    comments,
    chapterSnapshots,
    projectDictionary,
  };
}

async function deleteProjectData(projectId: string): Promise<void> {
  await deleteAllProjectData(projectId);
  await db.projects.delete(projectId);
}

async function insertProjectData(data: ProjectBackupData): Promise<void> {
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
}

async function importSingleProject(
  data: ProjectBackupData,
  options: ImportOptions,
): Promise<{ imported: boolean; skipped: boolean; replaced: boolean }> {
  const existingProject = await db.projects.get(data.project.id);

  if (existingProject) {
    if (options.conflictResolution === "skip") {
      return { imported: false, skipped: true, replaced: false };
    }

    if (options.conflictResolution === "replace") {
      await deleteProjectData(data.project.id);
      await insertProjectData(data);
      return { imported: true, skipped: false, replaced: true };
    }

    // duplicate: create new IDs
    const remappedData = remapProjectIds(data);
    await insertProjectData(remappedData);
    return { imported: true, skipped: false, replaced: false };
  }

  // No conflict - just insert
  await insertProjectData(data);
  return { imported: true, skipped: false, replaced: false };
}

export async function importBackup(
  backup: Backup,
  options: ImportOptions,
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    projectsImported: 0,
    projectsSkipped: 0,
    projectsReplaced: 0,
    settingsRestored: false,
    errors: [],
  };

  try {
    await db.transaction(
      "rw",
      [
        db.projects,
        db.chapters,
        db.characters,
        db.characterRelationships,
        db.locations,
        db.timelineEvents,
        db.styleGuideEntries,
        db.worldbuildingDocs,
        db.outlineGridColumns,
        db.outlineGridRows,
        db.outlineGridCells,
        db.writingSprints,
        db.writingSessions,
        db.playlistTracks,
        db.comments,
        db.chapterSnapshots,
        db.projectDictionaries,
        db.appSettings,
        db.appDictionary,
      ],
      async () => {
        // Import projects
        const projectsToImport = isFullBackup(backup)
          ? backup.projects
          : [backup.data];

        for (const projectData of projectsToImport) {
          const importResult = await importSingleProject(projectData, options);
          if (importResult.imported) {
            result.projectsImported++;
            if (importResult.replaced) {
              result.projectsReplaced++;
            }
          } else if (importResult.skipped) {
            result.projectsSkipped++;
          }
        }

        // Restore settings for full backups if requested
        if (isFullBackup(backup) && options.restoreSettings) {
          if (backup.appSettings) {
            await db.appSettings.put(backup.appSettings);
            result.settingsRestored = true;
          }
          if (backup.appDictionary) {
            await db.appDictionary.put(backup.appDictionary);
          }
        }
      },
    );
  } catch (error) {
    result.success = false;
    result.errors.push(
      error instanceof Error ? error.message : "Unknown error during import",
    );
  }

  return result;
}
