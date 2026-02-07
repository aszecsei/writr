import { z } from "zod/v4";
import {
  AppDictionarySchema,
  AppSettingsSchema,
  ChapterSchema,
  ChapterSnapshotSchema,
  CharacterRelationshipSchema,
  CharacterSchema,
  CommentSchema,
  LocationSchema,
  OutlineGridCellSchema,
  OutlineGridColumnSchema,
  OutlineGridRowSchema,
  PlaylistTrackSchema,
  ProjectDictionarySchema,
  ProjectSchema,
  StyleGuideEntrySchema,
  TimelineEventSchema,
  WorldbuildingDocSchema,
  WritingSessionSchema,
  WritingSprintSchema,
} from "@/db/schemas";
import { BACKUP_VERSION } from "./types";

export const BackupMetadataSchema = z.object({
  version: z.number().int().positive(),
  type: z.enum(["full", "project"]),
  exportedAt: z.iso.datetime(),
  projectCount: z.number().int().nonnegative().optional(),
  projectTitle: z.string().optional(),
});

export const ProjectBackupDataSchema = z.object({
  project: ProjectSchema,
  chapters: z.array(ChapterSchema),
  characters: z.array(CharacterSchema),
  characterRelationships: z.array(CharacterRelationshipSchema),
  locations: z.array(LocationSchema),
  timelineEvents: z.array(TimelineEventSchema),
  styleGuideEntries: z.array(StyleGuideEntrySchema),
  worldbuildingDocs: z.array(WorldbuildingDocSchema),
  outlineGridColumns: z.array(OutlineGridColumnSchema),
  outlineGridRows: z.array(OutlineGridRowSchema),
  outlineGridCells: z.array(OutlineGridCellSchema),
  writingSprints: z.array(WritingSprintSchema),
  writingSessions: z.array(WritingSessionSchema),
  playlistTracks: z.array(PlaylistTrackSchema),
  comments: z.array(CommentSchema),
  chapterSnapshots: z.array(ChapterSnapshotSchema).default([]),
  projectDictionary: ProjectDictionarySchema.optional(),
});

export const FullBackupSchema = z.object({
  metadata: BackupMetadataSchema.refine((m) => m.type === "full", {
    message: "Expected full backup metadata",
  }),
  appSettings: AppSettingsSchema.optional(),
  appDictionary: AppDictionarySchema.optional(),
  projects: z.array(ProjectBackupDataSchema),
});

export const ProjectBackupSchema = z.object({
  metadata: BackupMetadataSchema.refine((m) => m.type === "project", {
    message: "Expected project backup metadata",
  }),
  data: ProjectBackupDataSchema,
});

export const BackupSchema = z.union([FullBackupSchema, ProjectBackupSchema]);

export type BackupType = z.infer<typeof BackupSchema>;

export function validateBackup(data: unknown) {
  return BackupSchema.safeParse(data);
}

export function isBackupVersionSupported(version: number): boolean {
  return version <= BACKUP_VERSION;
}
