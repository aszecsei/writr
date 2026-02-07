import { db } from "@/db/database";
import { updateAppSettings } from "@/db/operations";
import { triggerDownload } from "@/lib/export/download";
import {
  BACKUP_VERSION,
  type Backup,
  type FullBackup,
  type ProjectBackup,
  type ProjectBackupData,
} from "./types";

export async function gatherProjectData(
  projectId: string,
): Promise<ProjectBackupData | null> {
  const project = await db.projects.get(projectId);
  if (!project) return null;

  const [
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
    projectDictionary,
  ] = await Promise.all([
    db.chapters.where({ projectId }).toArray(),
    db.characters.where({ projectId }).toArray(),
    db.characterRelationships.where({ projectId }).toArray(),
    db.locations.where({ projectId }).toArray(),
    db.timelineEvents.where({ projectId }).toArray(),
    db.styleGuideEntries.where({ projectId }).toArray(),
    db.worldbuildingDocs.where({ projectId }).toArray(),
    db.outlineGridColumns.where({ projectId }).toArray(),
    db.outlineGridRows.where({ projectId }).toArray(),
    db.outlineGridCells.where({ projectId }).toArray(),
    db.writingSprints.where({ projectId }).toArray(),
    db.writingSessions.where({ projectId }).toArray(),
    db.playlistTracks.where({ projectId }).toArray(),
    db.comments.where({ projectId }).toArray(),
    db.projectDictionaries.where({ projectId }).first(),
  ]);

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
    projectDictionary,
  };
}

export async function exportProject(
  projectId: string,
): Promise<ProjectBackup | null> {
  const data = await gatherProjectData(projectId);
  if (!data) return null;

  return {
    metadata: {
      version: BACKUP_VERSION,
      type: "project",
      exportedAt: new Date().toISOString(),
      projectTitle: data.project.title,
    },
    data,
  };
}

export async function exportFullBackup(): Promise<FullBackup> {
  const allProjects = await db.projects.toArray();
  const appSettings = await db.appSettings.get("app-settings");
  const appDictionary = await db.appDictionary.get("app-dictionary");

  const projectDataResults = await Promise.all(
    allProjects.map((project) => gatherProjectData(project.id)),
  );

  // Filter out any null results (shouldn't happen, but be safe)
  const projects = projectDataResults.filter(
    (data): data is ProjectBackupData => data !== null,
  );

  return {
    metadata: {
      version: BACKUP_VERSION,
      type: "full",
      exportedAt: new Date().toISOString(),
      projectCount: projects.length,
    },
    appSettings,
    appDictionary,
    projects,
  };
}

export function createBackupBlob(backup: Backup): Blob {
  const json = JSON.stringify(backup, null, 2);
  return new Blob([json], { type: "application/json" });
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function generateBackupFilename(backup: Backup): string {
  const date = formatDate(new Date());

  if (backup.metadata.type === "project" && "data" in backup) {
    const title = sanitizeFilename(backup.data.project.title);
    return `writr-${title}-${date}.json`;
  }

  return `writr-full-backup-${date}.json`;
}

export async function downloadFullBackup(): Promise<void> {
  const backup = await exportFullBackup();
  const blob = createBackupBlob(backup);
  const filename = generateBackupFilename(backup);
  triggerDownload(blob, filename);
  await updateAppSettings({ lastExportedAt: new Date().toISOString() });
}

export async function downloadProjectBackup(projectId: string): Promise<void> {
  const backup = await exportProject(projectId);
  if (!backup) {
    throw new Error("Project not found");
  }
  const blob = createBackupBlob(backup);
  const filename = generateBackupFilename(backup);
  triggerDownload(blob, filename);
  await updateAppSettings({ lastExportedAt: new Date().toISOString() });
}
