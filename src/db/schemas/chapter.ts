import { z } from "zod/v4";
import {
  ChapterIdSchema,
  ChapterSnapshotIdSchema,
  ChapterSummaryIdSchema,
  CharacterIdSchema,
  LocationIdSchema,
  ProjectIdSchema,
  SceneIdSchema,
} from "./ids";
import { timestamp } from "./shared";

// ─── Chapter ─────────────────────────────────────────────────────────

export const ChapterStatusEnum = z.enum(["draft", "revised", "final"]);
export type ChapterStatus = z.infer<typeof ChapterStatusEnum>;

// Binder taxonomy. A chapter row is either a real `document` (holds prose
// and may nest children) or a `separator` (a label marker dividing siblings).
const ChapterKindEnum = z.enum(["document", "separator"]);

// `manuscript` rows compile into the book; `scratchpad` rows are loose storage
// that never compiles and never counts toward the manuscript word count.
const ChapterSectionEnum = z.enum(["manuscript", "scratchpad"]);
export type ChapterSection = z.infer<typeof ChapterSectionEnum>;

export const ChapterSchema = z.object({
  id: ChapterIdSchema,
  projectId: ProjectIdSchema,
  title: z.string().min(1),
  // Sibling-scoped position within (projectId, section, parentChapterId).
  order: z.number().int().nonnegative(),
  content: z.string().default(""),
  synopsis: z.string().default(""),
  status: ChapterStatusEnum.default("draft"),
  wordCount: z.number().int().nonnegative().default(0),
  // ── Binder hierarchy ──
  parentChapterId: ChapterIdSchema.nullable().default(null),
  section: ChapterSectionEnum.default("manuscript"),
  kind: ChapterKindEnum.default("document"),
  // Separator-only semantics in v1: whether the marker prints into the compiled
  // manuscript, and whether it forces a page break before it.
  includeInCompile: z.boolean().default(true),
  pageBreakBefore: z.boolean().default(false),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Chapter = z.infer<typeof ChapterSchema>;

// ─── Scene ───────────────────────────────────────────────────────────
//
// Model D: a chapter's prose stays ONE TipTap document; scenes are its
// second-level subdivisions, delimited inside that document by `sceneBreak`
// marker nodes carrying a `sceneId`. A Scene row holds identity, ordering, and
// metadata only — never prose. The content before the first marker is the
// implicit "core scene" (order 0, backed by no marker), so every chapter
// document always has at least one scene and a writer never has to think about
// scenes until they insert a break.

export const TimelineModeEnum = z.enum([
  "linear",
  "flashback",
  "flashforward",
  "dream",
  "vision",
  "other",
]);
export type TimelineMode = z.infer<typeof TimelineModeEnum>;

export const SceneSchema = z.object({
  id: SceneIdSchema,
  projectId: ProjectIdSchema,
  chapterId: ChapterIdSchema,
  // Position within a chapter. order 0 is the core scene (content before the
  // first marker); it is the only scene with no backing `sceneBreak` node. A
  // chapter with N scenes has N−1 markers.
  order: z.number().int().nonnegative(),
  title: z.string().default(""),
  status: ChapterStatusEnum.default("draft"),
  povCharacterId: CharacterIdSchema.nullable().default(null),
  presentCharacterIds: z.array(CharacterIdSchema).default([]),
  locationIds: z.array(LocationIdSchema).default([]),
  timelineMode: TimelineModeEnum.default("linear"),
  // Free-text storyline threads with project-wide autocomplete (e.g. "1943").
  strands: z.array(z.string()).default([]),
  storyDate: z.string().default(""),
  storyTime: z.string().default(""),
  targetWordCount: z.number().int().nonnegative().default(0),
  // Derived: recomputed by the marker↔row sync engine by slicing the chapter
  // doc at markers. Persisted for cheap sidebar/subtitle display, mirroring how
  // Chapter.wordCount is persisted rather than recomputed on every read.
  wordCount: z.number().int().nonnegative().default(0),
  // Nestable via "/" (e.g. "arc/rising-action"), same convention as
  // WorldbuildingDoc.tags.
  tags: z.array(z.string()).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Scene = z.infer<typeof SceneSchema>;

// ─── Chapter Snapshot ────────────────────────────────────────────────

export const ChapterSnapshotSchema = z.object({
  id: ChapterSnapshotIdSchema,
  chapterId: ChapterIdSchema,
  projectId: ProjectIdSchema,
  name: z.string().min(1),
  content: z.string(),
  wordCount: z.number().int().nonnegative(),
  createdAt: timestamp,
});
export type ChapterSnapshot = z.infer<typeof ChapterSnapshotSchema>;

// ─── Chapter Summary ─────────────────────────────────────────────────

export const ChapterSummarySchema = z.object({
  id: ChapterSummaryIdSchema,
  projectId: ProjectIdSchema,
  chapterId: ChapterIdSchema,
  /** sha-256 of the source chapter content; mismatch invalidates the row. */
  sourceContentHash: z.string().min(1),
  summary: z.string(),
  createdAt: timestamp,
});
export type ChapterSummary = z.infer<typeof ChapterSummarySchema>;
