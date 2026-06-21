import type {
  AppDictionary,
  AppSettings,
  BrainstormIdea,
  BrainstormSetup,
  Chapter,
  ChapterSnapshot,
  Character,
  CharacterRelationship,
  Comment,
  GuardrailEntry,
  Location,
  OutlineGridCell,
  OutlineGridColumn,
  OutlineGridRow,
  PlaylistTrack,
  Project,
  ProjectDictionary,
  SavedPrompt,
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
  guardrailEntries: GuardrailEntry[];
  worldbuildingDocs: WorldbuildingDoc[];
  outlineGridColumns: OutlineGridColumn[];
  outlineGridRows: OutlineGridRow[];
  outlineGridCells: OutlineGridCell[];
  writingSprints: WritingSprint[];
  writingSessions: WritingSession[];
  playlistTracks: PlaylistTrack[];
  comments: Comment[];
  chapterSnapshots: ChapterSnapshot[];
  projectDictionary?: ProjectDictionary;
}

/**
 * Global, non-project-scoped data carried in full backups. Optional so older
 * backups (without this section) still validate and import.
 */
export interface GlobalsBackupData {
  savedPrompts: SavedPrompt[];
  brainstormSetups: BrainstormSetup[];
  brainstormIdeas: BrainstormIdea[];
}

export interface FullBackup {
  metadata: BackupMetadata;
  appSettings?: AppSettings;
  appDictionary?: AppDictionary;
  globals?: GlobalsBackupData;
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
