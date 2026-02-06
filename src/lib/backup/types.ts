import type {
  AppSettings,
  Chapter,
  Character,
  CharacterRelationship,
  Comment,
  Location,
  OutlineGridCell,
  OutlineGridColumn,
  OutlineGridRow,
  PlaylistTrack,
  Project,
  StyleGuideEntry,
  TimelineEvent,
  WorldbuildingDoc,
  WritingSession,
  WritingSprint,
} from "@/db/schemas";

export const BACKUP_VERSION = 1;

export interface BackupMetadata {
  version: number;
  type: "full" | "project";
  exportedAt: string;
  projectCount?: number;
  projectTitle?: string;
}

export interface ProjectBackupData {
  project: Project;
  chapters: Chapter[];
  characters: Character[];
  characterRelationships: CharacterRelationship[];
  locations: Location[];
  timelineEvents: TimelineEvent[];
  styleGuideEntries: StyleGuideEntry[];
  worldbuildingDocs: WorldbuildingDoc[];
  outlineGridColumns: OutlineGridColumn[];
  outlineGridRows: OutlineGridRow[];
  outlineGridCells: OutlineGridCell[];
  writingSprints: WritingSprint[];
  writingSessions: WritingSession[];
  playlistTracks: PlaylistTrack[];
  comments: Comment[];
}

export interface FullBackup {
  metadata: BackupMetadata;
  appSettings?: AppSettings;
  projects: ProjectBackupData[];
}

export interface ProjectBackup {
  metadata: BackupMetadata;
  data: ProjectBackupData;
}

export type Backup = FullBackup | ProjectBackup;

export type ConflictResolution = "skip" | "replace" | "duplicate";

export interface ImportOptions {
  conflictResolution: ConflictResolution;
  restoreSettings: boolean;
}

export interface ImportResult {
  success: boolean;
  projectsImported: number;
  projectsSkipped: number;
  projectsReplaced: number;
  settingsRestored: boolean;
  errors: string[];
}
