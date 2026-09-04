import { z } from "zod/v4";
import {
  ChapterIdSchema,
  CharacterIdSchema,
  CharacterRelationshipIdSchema,
  EntityImageIdSchema,
  GuardrailEntryIdSchema,
  LocationIdSchema,
  ProjectIdSchema,
  StyleGuideEntryIdSchema,
  TimelineEventIdSchema,
  WorldbuildingDocIdSchema,
} from "./ids";
import { timestamp } from "./shared";

// ─── Entity Image ───────────────────────────────────────────────────

const EntityImageSchema = z.object({
  id: EntityImageIdSchema,
  url: z.string().url(),
  caption: z.string().default(""),
  isPrimary: z.boolean().default(false),
  /** Normalized focal point in [0,1] for CSS `object-position` when the image
   *  is cropped. Defaults to top-center to keep portrait heads in frame. */
  focalX: z.number().min(0).max(1).default(0.5),
  focalY: z.number().min(0).max(1).default(0),
});
export type EntityImage = z.infer<typeof EntityImageSchema>;

// ─── Character ───────────────────────────────────────────────────────

export const CharacterRoleEnum = z.enum([
  "protagonist",
  "antagonist",
  "supporting",
  "minor",
]);
export type CharacterRole = z.infer<typeof CharacterRoleEnum>;

export const CharacterSchema = z.object({
  id: CharacterIdSchema,
  projectId: ProjectIdSchema,
  name: z.string().min(1),
  role: CharacterRoleEnum.default("supporting"),
  pronouns: z.string().default(""),
  aliases: z.array(z.string()).default([]),
  summary: z.string().default(""),
  description: z.string().default(""),
  personality: z.string().default(""),
  motivations: z.string().default(""),
  internalConflict: z.string().default(""),
  strengths: z.string().default(""),
  weaknesses: z.string().default(""),
  characterArcs: z.string().default(""),
  dialogueStyle: z.string().default(""),
  backstory: z.string().default(""),
  notes: z.string().default(""),
  linkedCharacterIds: z.array(CharacterIdSchema).default([]),
  linkedLocationIds: z.array(LocationIdSchema).default([]),
  images: z.array(EntityImageSchema).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Character = z.infer<typeof CharacterSchema>;

// ─── Character Relationship ──────────────────────────────────────────

const RelationshipTypeEnum = z.enum([
  "parent",
  "child",
  "spouse",
  "divorced",
  "sibling",
  "custom",
]);
export type RelationshipType = z.infer<typeof RelationshipTypeEnum>;

export const CharacterRelationshipSchema = z.object({
  id: CharacterRelationshipIdSchema,
  projectId: ProjectIdSchema,
  sourceCharacterId: CharacterIdSchema,
  targetCharacterId: CharacterIdSchema,
  type: RelationshipTypeEnum,
  customLabel: z.string().default(""),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type CharacterRelationship = z.infer<typeof CharacterRelationshipSchema>;

// ─── Location ────────────────────────────────────────────────────────

export const LocationSchema = z.object({
  id: LocationIdSchema,
  projectId: ProjectIdSchema,
  name: z.string().min(1),
  description: z.string().default(""),
  parentLocationId: LocationIdSchema.nullable().default(null),
  notes: z.string().default(""),
  linkedCharacterIds: z.array(CharacterIdSchema).default([]),
  images: z.array(EntityImageSchema).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Location = z.infer<typeof LocationSchema>;

// ─── Timeline Event ──────────────────────────────────────────────────

export const TimelineEventSchema = z.object({
  id: TimelineEventIdSchema,
  projectId: ProjectIdSchema,
  title: z.string().min(1),
  description: z.string().default(""),
  date: z.string().default(""),
  order: z.number().int().nonnegative(),
  linkedChapterIds: z.array(ChapterIdSchema).default([]),
  linkedCharacterIds: z.array(CharacterIdSchema).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

// ─── Style Guide Entry ──────────────────────────────────────────────

const StyleGuideCategoryEnum = z.enum([
  "voice",
  "pov",
  "tense",
  "formatting",
  "vocabulary",
  "custom",
]);
export type StyleGuideCategory = z.infer<typeof StyleGuideCategoryEnum>;

export const StyleGuideEntrySchema = z.object({
  id: StyleGuideEntryIdSchema,
  // null = global (applies to every project); otherwise scoped to a project.
  projectId: ProjectIdSchema.nullable().default(null),
  category: StyleGuideCategoryEnum.default("custom"),
  title: z.string().min(1),
  content: z.string().default(""),
  order: z.number().int().nonnegative(),
  /** Projects in which this entry is deactivated (per-project disable). */
  disabledProjectIds: z.array(ProjectIdSchema).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type StyleGuideEntry = z.infer<typeof StyleGuideEntrySchema>;

// ─── Guardrail Entry ────────────────────────────────────────────────
//
// A "negative" companion to the style guide: a named issue to flag, the set
// of trigger phrases that surface it, and how to fix it. Unlike a style-guide
// rule (a positive `title` + `content`), a guardrail carries structured
// `flags` plus a corrective `fix` and an affirmative `positiveFix`.

export const GuardrailEntrySchema = z.object({
  id: GuardrailEntryIdSchema,
  // null = global (applies to every project); otherwise scoped to a project.
  projectId: ProjectIdSchema.nullable().default(null),
  label: z.string().min(1),
  flags: z.array(z.string()).default([]),
  fix: z.string().default(""),
  positiveFix: z.string().default(""),
  order: z.number().int().nonnegative(),
  /** Projects in which this entry is deactivated (per-project disable). */
  disabledProjectIds: z.array(ProjectIdSchema).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type GuardrailEntry = z.infer<typeof GuardrailEntrySchema>;

// ─── Worldbuilding Doc ───────────────────────────────────────────────

export const WorldbuildingDocSchema = z.object({
  id: WorldbuildingDocIdSchema,
  projectId: ProjectIdSchema,
  title: z.string().min(1),
  content: z.string().default(""),
  tags: z.array(z.string()).default([]),
  parentDocId: WorldbuildingDocIdSchema.nullable().default(null),
  order: z.number().int().nonnegative().default(0),
  linkedCharacterIds: z.array(CharacterIdSchema).default([]),
  linkedLocationIds: z.array(LocationIdSchema).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type WorldbuildingDoc = z.infer<typeof WorldbuildingDocSchema>;
