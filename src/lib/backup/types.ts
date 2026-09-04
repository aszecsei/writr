import type { z } from "zod/v4";
import type {
  BackupMetadataSchema,
  FullBackupSchema,
  GlobalsBackupDataSchema,
  ProjectBackupDataSchema,
  ProjectBackupSchema,
} from "./validation";

export const BACKUP_VERSION = 1;

export type BackupMetadata = z.infer<typeof BackupMetadataSchema>;

export type ProjectBackupData = z.infer<typeof ProjectBackupDataSchema>;

export type GlobalsBackupData = z.infer<typeof GlobalsBackupDataSchema>;

export type FullBackup = z.infer<typeof FullBackupSchema>;

export type ProjectBackup = z.infer<typeof ProjectBackupSchema>;

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
