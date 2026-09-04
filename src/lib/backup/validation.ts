import { z } from "zod/v4";
import {
  AppDictionarySchema,
  AppSettingsSchema,
  BrainstormIdeaSchema,
  BrainstormSetupSchema,
  ChapterSchema,
  ChapterSnapshotSchema,
  CharacterRelationshipSchema,
  CharacterSchema,
  CommentSchema,
  GuardrailEntrySchema,
  LocationSchema,
  normalizeAppSettings,
  OutlineGridCellSchema,
  OutlineGridColumnSchema,
  OutlineGridRowSchema,
  PlaylistTrackSchema,
  ProjectDictionarySchema,
  ProjectSchema,
  SavedPromptSchema,
  SceneSchema,
  StyleGuideEntrySchema,
  TimelineEventSchema,
  WorldbuildingDocSchema,
  WritingSessionSchema,
  WritingSprintSchema,
} from "@/db/schemas";
import { BACKUP_VERSION } from "./types";

const BackupMetadataSchema = z.object({
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
  // `.default([])` so backups exported before guardrails still validate.
  guardrailEntries: z.array(GuardrailEntrySchema).default([]),
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
  scenes: z.array(SceneSchema).default([]),
});

const GlobalsBackupDataSchema = z.object({
  savedPrompts: z.array(SavedPromptSchema).default([]),
  brainstormSetups: z.array(BrainstormSetupSchema).default([]),
  brainstormIdeas: z.array(BrainstormIdeaSchema).default([]),
});

export const FullBackupSchema = z.object({
  metadata: BackupMetadataSchema.refine((m) => m.type === "full", {
    message: "Expected full backup metadata",
  }),
  appSettings: AppSettingsSchema.optional(),
  appDictionary: AppDictionarySchema.optional(),
  globals: GlobalsBackupDataSchema.optional(),
  projects: z.array(ProjectBackupDataSchema),
});

export const ProjectBackupSchema = z.object({
  metadata: BackupMetadataSchema.refine((m) => m.type === "project", {
    message: "Expected project backup metadata",
  }),
  data: ProjectBackupDataSchema,
});

const BackupSchema = z.union([FullBackupSchema, ProjectBackupSchema]);

export function validateBackup(data: unknown) {
  // Normalize old-format appSettings (individual API key fields → records)
  if (data && typeof data === "object" && "appSettings" in data) {
    const raw = data as Record<string, unknown>;
    if (raw.appSettings && typeof raw.appSettings === "object") {
      raw.appSettings = normalizeAppSettings(
        raw.appSettings as Record<string, unknown>,
      );
    }
  }
  return BackupSchema.safeParse(data);
}

export function isBackupVersionSupported(version: number): boolean {
  return version <= BACKUP_VERSION;
}
