import { z } from "zod/v4";

// ─── Shared Primitives ───────────────────────────────────────────────

const id = z.uuid();
const timestamp = z.iso.datetime();
const projectFk = z.uuid();

// ─── Project ─────────────────────────────────────────────────────────

export const ProjectSchema = z.object({
  id,
  title: z.string().min(1),
  description: z.string().default(""),
  genre: z.string().default(""),
  targetWordCount: z.number().int().nonnegative().default(0),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Project = z.infer<typeof ProjectSchema>;

// ─── Chapter ─────────────────────────────────────────────────────────

export const ChapterStatusEnum = z.enum(["draft", "revised", "final"]);
export type ChapterStatus = z.infer<typeof ChapterStatusEnum>;

export const ChapterSchema = z.object({
  id,
  projectId: projectFk,
  title: z.string().min(1),
  order: z.number().int().nonnegative(),
  content: z.string().default(""),
  synopsis: z.string().default(""),
  status: ChapterStatusEnum.default("draft"),
  wordCount: z.number().int().nonnegative().default(0),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Chapter = z.infer<typeof ChapterSchema>;

// ─── Character ───────────────────────────────────────────────────────

export const CharacterRoleEnum = z.enum([
  "protagonist",
  "antagonist",
  "supporting",
  "minor",
]);
export type CharacterRole = z.infer<typeof CharacterRoleEnum>;

export const CharacterSchema = z.object({
  id,
  projectId: projectFk,
  name: z.string().min(1),
  role: CharacterRoleEnum.default("supporting"),
  aliases: z.array(z.string()).default([]),
  description: z.string().default(""),
  backstory: z.string().default(""),
  notes: z.string().default(""),
  linkedCharacterIds: z.array(z.uuid()).default([]),
  linkedLocationIds: z.array(z.uuid()).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Character = z.infer<typeof CharacterSchema>;

// ─── Character Relationship ──────────────────────────────────────────

export const RelationshipTypeEnum = z.enum([
  "parent",
  "child",
  "spouse",
  "divorced",
  "sibling",
  "custom",
]);
export type RelationshipType = z.infer<typeof RelationshipTypeEnum>;

export const CharacterRelationshipSchema = z.object({
  id,
  projectId: projectFk,
  sourceCharacterId: z.uuid(),
  targetCharacterId: z.uuid(),
  type: RelationshipTypeEnum,
  customLabel: z.string().default(""),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type CharacterRelationship = z.infer<typeof CharacterRelationshipSchema>;

// ─── Location ────────────────────────────────────────────────────────

export const LocationSchema = z.object({
  id,
  projectId: projectFk,
  name: z.string().min(1),
  description: z.string().default(""),
  parentLocationId: z.uuid().nullable().default(null),
  notes: z.string().default(""),
  linkedCharacterIds: z.array(z.uuid()).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Location = z.infer<typeof LocationSchema>;

// ─── Timeline Event ──────────────────────────────────────────────────

export const TimelineEventSchema = z.object({
  id,
  projectId: projectFk,
  title: z.string().min(1),
  description: z.string().default(""),
  date: z.string().default(""),
  order: z.number().int().nonnegative(),
  linkedChapterIds: z.array(z.uuid()).default([]),
  linkedCharacterIds: z.array(z.uuid()).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

// ─── Style Guide Entry ──────────────────────────────────────────────

export const StyleGuideCategoryEnum = z.enum([
  "voice",
  "pov",
  "tense",
  "formatting",
  "vocabulary",
  "custom",
]);
export type StyleGuideCategory = z.infer<typeof StyleGuideCategoryEnum>;

export const StyleGuideEntrySchema = z.object({
  id,
  projectId: projectFk,
  category: StyleGuideCategoryEnum.default("custom"),
  title: z.string().min(1),
  content: z.string().default(""),
  order: z.number().int().nonnegative(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type StyleGuideEntry = z.infer<typeof StyleGuideEntrySchema>;

// ─── Worldbuilding Doc ───────────────────────────────────────────────

export const WorldbuildingDocSchema = z.object({
  id,
  projectId: projectFk,
  title: z.string().min(1),
  content: z.string().default(""),
  tags: z.array(z.string()).default([]),
  parentDocId: z.uuid().nullable().default(null),
  order: z.number().int().nonnegative().default(0),
  linkedCharacterIds: z.array(z.uuid()).default([]),
  linkedLocationIds: z.array(z.uuid()).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type WorldbuildingDoc = z.infer<typeof WorldbuildingDocSchema>;

// ─── App Settings (singleton) ────────────────────────────────────────

export const AppSettingsSchema = z.object({
  id: z.literal("app-settings"),
  openRouterApiKey: z.string().default(""),
  preferredModel: z.string().default("openai/gpt-4o"),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  autoSaveIntervalMs: z.number().int().positive().default(3000),
  editorFontSize: z.number().int().positive().default(16),
  editorFont: z.string().default("literata"),
  debugMode: z.boolean().default(false),
  updatedAt: timestamp,
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;
