import { z } from "zod/v4";

// ─── Shared Primitives ───────────────────────────────────────────────

const timestamp = z.iso.datetime();

const DATA_IMAGE_URL_PATTERN = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;

/** Accepts "" (no image), an http(s) URL, or a base64 `data:image/*` URL. */
export function isSupportedImageSource(value: string): boolean {
  return (
    value === "" ||
    /^https?:\/\//.test(value) ||
    DATA_IMAGE_URL_PATTERN.test(value)
  );
}

const ImageSourceSchema = z.string().refine(isSupportedImageSource, {
  message: "Must be an http(s) URL or a data:image/*;base64 URL",
});

// ─── Branded Entity ID Schemas ──────────────────────────────────────
//
// Each entity's primary key gets a distinct brand so the type system
// catches accidental cross-entity ID assignment (e.g. passing a chapter
// id where a project id is expected). FK fields below reuse the
// destination entity's brand so a `Chapter.projectId` is structurally
// identical to a `Project.id`.

export const ProjectIdSchema = z.uuid().brand<"ProjectId">();
export type ProjectId = z.infer<typeof ProjectIdSchema>;

export const ChapterIdSchema = z.uuid().brand<"ChapterId">();
export type ChapterId = z.infer<typeof ChapterIdSchema>;

const CharacterIdSchema = z.uuid().brand<"CharacterId">();
export type CharacterId = z.infer<typeof CharacterIdSchema>;

const LocationIdSchema = z.uuid().brand<"LocationId">();
export type LocationId = z.infer<typeof LocationIdSchema>;

const TimelineEventIdSchema = z.uuid().brand<"TimelineEventId">();
export type TimelineEventId = z.infer<typeof TimelineEventIdSchema>;

const StyleGuideEntryIdSchema = z.uuid().brand<"StyleGuideEntryId">();
export type StyleGuideEntryId = z.infer<typeof StyleGuideEntryIdSchema>;

const GuardrailEntryIdSchema = z.uuid().brand<"GuardrailEntryId">();
export type GuardrailEntryId = z.infer<typeof GuardrailEntryIdSchema>;

const WorldbuildingDocIdSchema = z.uuid().brand<"WorldbuildingDocId">();
export type WorldbuildingDocId = z.infer<typeof WorldbuildingDocIdSchema>;

const CharacterRelationshipIdSchema = z
  .uuid()
  .brand<"CharacterRelationshipId">();
export type CharacterRelationshipId = z.infer<
  typeof CharacterRelationshipIdSchema
>;

const OutlineGridColumnIdSchema = z.uuid().brand<"OutlineGridColumnId">();
export type OutlineGridColumnId = z.infer<typeof OutlineGridColumnIdSchema>;

const OutlineGridRowIdSchema = z.uuid().brand<"OutlineGridRowId">();
export type OutlineGridRowId = z.infer<typeof OutlineGridRowIdSchema>;

const OutlineGridCellIdSchema = z.uuid().brand<"OutlineGridCellId">();
export type OutlineGridCellId = z.infer<typeof OutlineGridCellIdSchema>;

const WritingSprintIdSchema = z.uuid().brand<"WritingSprintId">();
export type WritingSprintId = z.infer<typeof WritingSprintIdSchema>;

const WritingSessionIdSchema = z.uuid().brand<"WritingSessionId">();
export type WritingSessionId = z.infer<typeof WritingSessionIdSchema>;

const PlaylistTrackIdSchema = z.uuid().brand<"PlaylistTrackId">();
export type PlaylistTrackId = z.infer<typeof PlaylistTrackIdSchema>;

const CommentIdSchema = z.uuid().brand<"CommentId">();
export type CommentId = z.infer<typeof CommentIdSchema>;

const ChapterSnapshotIdSchema = z.uuid().brand<"ChapterSnapshotId">();
export type ChapterSnapshotId = z.infer<typeof ChapterSnapshotIdSchema>;

const ProjectDictionaryIdSchema = z.uuid().brand<"ProjectDictionaryId">();
export type ProjectDictionaryId = z.infer<typeof ProjectDictionaryIdSchema>;

const ChapterSummaryIdSchema = z.uuid().brand<"ChapterSummaryId">();
export type ChapterSummaryId = z.infer<typeof ChapterSummaryIdSchema>;

const AgentDefinitionIdSchema = z.uuid().brand<"AgentDefinitionId">();
export type AgentDefinitionId = z.infer<typeof AgentDefinitionIdSchema>;

const EntityImageIdSchema = z.uuid().brand<"EntityImageId">();
export type EntityImageId = z.infer<typeof EntityImageIdSchema>;

const IndexedChunkIdSchema = z.uuid().brand<"IndexedChunkId">();
export type IndexedChunkId = z.infer<typeof IndexedChunkIdSchema>;

const SceneIdSchema = z.uuid().brand<"SceneId">();
export type SceneId = z.infer<typeof SceneIdSchema>;

// ─── Project Mode ───────────────────────────────────────────────────

const ProjectModeEnum = z.enum(["prose", "screenplay"]);
export type ProjectMode = z.infer<typeof ProjectModeEnum>;

// ─── Project ─────────────────────────────────────────────────────────

export const ProjectSchema = z.object({
  id: ProjectIdSchema,
  title: z.string().min(1),
  description: z.string().default(""),
  genre: z.string().default(""),
  targetWordCount: z.number().int().nonnegative().default(0),
  mode: ProjectModeEnum.default("prose"),
  /** Cover art, displayed cropped to 2:3. "" means no cover. */
  coverImageUrl: ImageSourceSchema.default(""),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Project = z.infer<typeof ProjectSchema>;

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

// ─── App Dictionary (singleton) ─────────────────────────────────────

export const AppDictionarySchema = z.object({
  id: z.literal("app-dictionary"),
  words: z.array(z.string()).default([]),
  updatedAt: timestamp,
});
export type AppDictionary = z.infer<typeof AppDictionarySchema>;

// ─── Project Dictionary ─────────────────────────────────────────────

export const ProjectDictionarySchema = z.object({
  id: ProjectDictionaryIdSchema,
  projectId: ProjectIdSchema,
  words: z.array(z.string()).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type ProjectDictionary = z.infer<typeof ProjectDictionarySchema>;

// ─── Outline Card Color (shared by grid cells) ─────────────────────

export const OutlineCardColorEnum = z.enum([
  "yellow",
  "pink",
  "blue",
  "green",
  "orange",
  "purple",
  "white",
]);
export type OutlineCardColor = z.infer<typeof OutlineCardColorEnum>;

// ─── Outline Grid Column ────────────────────────────────────────────

export const OutlineGridColumnSchema = z.object({
  id: OutlineGridColumnIdSchema,
  projectId: ProjectIdSchema,
  title: z.string().min(1),
  order: z.number().int().nonnegative(),
  width: z.number().int().positive().default(200),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type OutlineGridColumn = z.infer<typeof OutlineGridColumnSchema>;

// ─── Outline Grid Row ───────────────────────────────────────────────

export const OutlineGridRowSchema = z.object({
  id: OutlineGridRowIdSchema,
  projectId: ProjectIdSchema,
  linkedChapterId: ChapterIdSchema.nullable().default(null),
  label: z.string().default(""),
  order: z.number().int().nonnegative(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type OutlineGridRow = z.infer<typeof OutlineGridRowSchema>;

// ─── Outline Grid Cell ──────────────────────────────────────────────

export const OutlineGridCellSchema = z.object({
  id: OutlineGridCellIdSchema,
  projectId: ProjectIdSchema,
  rowId: OutlineGridRowIdSchema,
  columnId: OutlineGridColumnIdSchema,
  content: z.string().default(""),
  color: OutlineCardColorEnum.default("white"),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type OutlineGridCell = z.infer<typeof OutlineGridCellSchema>;

// ─── AI Provider ────────────────────────────────────────────────────

export const AiProviderEnum = z.enum([
  "openrouter",
  "anthropic",
  "openai",
  "grok",
  "zai",
  "google",
  "vertex",
]);
export type AiProvider = z.infer<typeof AiProviderEnum>;

// ─── Reasoning Effort ────────────────────────────────────────────────

const ReasoningEffortEnum = z.enum([
  "xhigh",
  "high",
  "medium",
  "low",
  "minimal",
  "none",
]);
export type ReasoningEffort = z.infer<typeof ReasoningEffortEnum>;

// ─── Agents ─────────────────────────────────────────────────────────

/**
 * All agent kinds: chat-mode user-facing agents and user-created agents.
 */
const AgentKindEnum = z.enum([
  // User-facing chat agents (selectable from AiPanel dropdown).
  "spark",
  "scene",
  "reader",
  "editor",
  "character-dialogue",
  "brainstorm",
  "chat",
  "beta-reader",
  "outline-architect",
  "worldbuilder",
  "orchestrator-chat",
  "researcher",
  "prose-writer",
  // User-created via Manage Agents.
  "user",
]);
export type AgentKind = z.infer<typeof AgentKindEnum>;

const AgentModelOverrideSchema = z.object({
  provider: AiProviderEnum,
  model: z.string().min(1),
  reasoningEffort: ReasoningEffortEnum.optional(),
});
export type AgentModelOverride = z.infer<typeof AgentModelOverrideSchema>;

/**
 * Unified agent definition row. Backs the built-in chat agents and any
 * user-created agents (kind="user"). Fields are seeded from bundled defaults
 * when a built-in agent is first written; "Reset to defaults" rewrites them.
 *
 * Built-in agents are global (projectId=null) and singleton-per-kind. User
 * agents may be project-scoped or global; multiple `kind="user"` rows are
 * allowed.
 *
 * Distinct from the runner-side `Agent` interface in `src/lib/ai/agents/types`
 * — that's an ephemeral per-invocation runnable; this is the persistent
 * definition the runner constructs from.
 */
export const AgentDefinitionSchema = z.object({
  id: AgentDefinitionIdSchema,
  kind: AgentKindEnum,
  /** null = global (built-ins always null; users can opt project-scoped). */
  projectId: ProjectIdSchema.nullable().default(null),
  name: z.string().min(1),
  description: z.string().default(""),
  systemPrompt: z.string().min(1),
  /** Tool ids the agent may use. Empty = no tools (text-only). */
  allowedToolIds: z.array(z.string()).default([]),
  modelOverride: AgentModelOverrideSchema.nullable().default(null),
  /** Optional assistant prefill; piped through to the runner. */
  assistantPrefill: z.string().default(""),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

// ─── Saved Prompts ──────────────────────────────────────────────────

const SavedPromptIdSchema = z.uuid().brand<"SavedPromptId">();
export type SavedPromptId = z.infer<typeof SavedPromptIdSchema>;

export const SavedPromptSchema = z.object({
  id: SavedPromptIdSchema,
  // null = global (available in every project); otherwise scoped to a project.
  projectId: ProjectIdSchema.nullable().default(null),
  title: z.string().min(1),
  body: z.string().default(""),
  // Non-null = a bundled built-in prompt, keyed by this stable identifier. Such
  // rows are seeded on boot, non-deletable, and resettable to their default
  // (mirrors built-in agents). null = a user-created prompt.
  builtinKey: z.string().nullable().default(null),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type SavedPrompt = z.infer<typeof SavedPromptSchema>;

// ─── Brainstorm ──────────────────────────────────────────────────────

const BrainstormSetupIdSchema = z.uuid().brand<"BrainstormSetupId">();
export type BrainstormSetupId = z.infer<typeof BrainstormSetupIdSchema>;

const BrainstormIdeaIdSchema = z.uuid().brand<"BrainstormIdeaId">();
export type BrainstormIdeaId = z.infer<typeof BrainstormIdeaIdSchema>;

// A named column is a list of string options. Columns are embedded in their
// setup (meaningless on their own, always edited together), not a table.
const BrainstormColumnSchema = z.object({
  name: z.string().min(1),
  options: z.array(z.string()).default([]),
});
export type BrainstormColumn = z.infer<typeof BrainstormColumnSchema>;

export const BrainstormSetupSchema = z.object({
  id: BrainstormSetupIdSchema,
  name: z.string().min(1),
  columns: z.array(BrainstormColumnSchema).default([]),
  // Madlibs-style pattern referencing columns by name as [columnName].
  pattern: z.string().default(""),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type BrainstormSetup = z.infer<typeof BrainstormSetupSchema>;

export const BrainstormIdeaSchema = z.object({
  id: BrainstormIdeaIdSchema,
  // The setup that produced this idea. Nullable (and not an enforced FK) so an
  // idea survives deletion of its setup.
  setupId: BrainstormSetupIdSchema.nullable().default(null),
  ideaText: z.string().min(1),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type BrainstormIdea = z.infer<typeof BrainstormIdeaSchema>;

// ─── App Settings (singleton) ────────────────────────────────────────

const PrimaryColorEnum = z.enum([
  "blue",
  "indigo",
  "violet",
  "rose",
  "emerald",
  "amber",
  "teal",
  "orange",
  "cyan",
  "pink",
]);
export type PrimaryColor = z.infer<typeof PrimaryColorEnum>;

const NeutralColorEnum = z.enum(["zinc", "slate", "gray", "stone", "neutral"]);
export type NeutralColor = z.infer<typeof NeutralColorEnum>;

const EditorWidthEnum = z.enum(["narrow", "medium", "wide"]);
export type EditorWidth = z.infer<typeof EditorWidthEnum>;

const UiDensityEnum = z.enum(["compact", "comfortable"]);
export type UiDensity = z.infer<typeof UiDensityEnum>;

const GoalCountdownDisplayEnum = z.enum([
  "estimated-date",
  "time-remaining",
  "off",
]);
export type GoalCountdownDisplay = z.infer<typeof GoalCountdownDisplayEnum>;

/**
 * Delimiters wrapping a "hole" — a section the author intentionally skips,
 * usually holding a plaintext summary. See `src/lib/holes.ts`.
 */
const HoleDelimitersSchema = z.object({
  open: z.string().min(1).default("["),
  close: z.string().min(1).default("]"),
});

/**
 * Grammar categories (lint kinds) switched off by default. "Style" is noisy for
 * fiction prose, so it's off until the user opts in via the Grammar Rules modal.
 * Used both for the schema default and the modal's "Reset to defaults".
 */
export const DEFAULT_DISABLED_LINT_KINDS: string[] = ["Style"];

export const AppSettingsSchema = z.object({
  id: z.literal("app-settings"),
  enableAiFeatures: z.boolean().default(false),
  aiProvider: AiProviderEnum.default("openrouter"),
  providerApiKeys: z.record(AiProviderEnum, z.string()).default({
    openrouter: "",
    anthropic: "",
    openai: "",
    grok: "",
    zai: "",
    google: "",
    vertex: "",
  }),
  providerModels: z.record(AiProviderEnum, z.string()).default({
    openrouter: "openai/gpt-4o",
    anthropic: "claude-sonnet-4-5-20250929",
    openai: "gpt-4o",
    grok: "grok-3",
    zai: "glm-4.7",
    google: "gemini-2.5-flash",
    vertex: "gemini-2.5-flash",
  }),
  /**
   * Per-provider TTS model. Empty string hides the Read Aloud button.
   * Only OpenRouter is wired in the UI today; other entries exist solely
   * so the record stays a Record<AiProvider, string>.
   */
  providerTtsModels: z.record(AiProviderEnum, z.string()).default({
    openrouter: "",
    anthropic: "",
    openai: "",
    grok: "",
    zai: "",
    google: "",
    vertex: "",
  }),
  providerTtsVoices: z.record(AiProviderEnum, z.string()).default({
    openrouter: "",
    anthropic: "",
    openai: "",
    grok: "",
    zai: "",
    google: "",
    vertex: "",
  }),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  primaryColor: PrimaryColorEnum.default("blue"),
  neutralColor: NeutralColorEnum.default("zinc"),
  editorWidth: EditorWidthEnum.default("medium"),
  uiDensity: UiDensityEnum.default("comfortable"),
  autoSaveIntervalMs: z.number().int().positive().default(3000),
  editorFontSize: z.number().int().positive().default(16),
  editorFont: z.string().default("literata"),
  /** Master switch for the harper.js grammar/style checker in the editor. */
  grammarCheckerEnabled: z.boolean().default(false),
  /**
   * harper lint categories (lint kinds, e.g. "Style", "Punctuation") the user
   * has switched off. Applied as a post-hoc filter on results. Defaults to
   * {@link DEFAULT_DISABLED_LINT_KINDS}.
   */
  disabledLintKinds: z
    .array(z.string())
    .default(() => [...DEFAULT_DISABLED_LINT_KINDS]),
  /**
   * Per-rule overrides for harper's individual lint rules (rule key → enabled).
   * Only explicit overrides are stored; absent keys use harper's default.
   */
  grammarRuleOverrides: z.record(z.string(), z.boolean()).default({}),
  debugMode: z.boolean().default(false),
  streamResponses: z.boolean().default(true),
  reasoningEffort: ReasoningEffortEnum.default("medium"),
  readingSpeedWpm: z.number().int().positive().default(200),
  autoFocusModeOnSprint: z.boolean().default(false),
  goalCountdownDisplay: GoalCountdownDisplayEnum.default("estimated-date"),
  postChatInstructions: z.string().default(""),
  postChatInstructionsDepth: z.number().int().nonnegative().default(2),
  assistantPrefill: z.string().default(""),
  enableToolCalling: z.boolean().default(false),
  customSystemPrompt: z.string().nullable().default(null),
  lastExportedAt: z.string().datetime().nullable().default(null),
  holeDelimiters: HoleDelimitersSchema.default({ open: "[", close: "]" }),
  /**
   * Background translucency of hole highlights (0–1). Low while drafting so the
   * note recedes; high while editing so unfilled holes stand out.
   */
  holeHighlightOpacity: z.number().min(0).max(1).default(0.18),
  /** Master switch: embed & retrieve lore/scenes into chat context. */
  loreRetrievalEnabled: z.boolean().default(false),
  /** When true, future scenes are included in retrieval results. */
  omniscientMode: z.boolean().default(false),
  /** Number of lore chunks to surface per chat turn. */
  loreTopK: z.number().int().nonnegative().default(5),
  /** Number of scene chunks to surface per chat turn. */
  sceneTopK: z.number().int().nonnegative().default(3),
  /** Minimum cosine similarity score [−1, 1] for a chunk to be included. */
  similarityFloor: z.number().min(-1).max(1).default(0.3),
  updatedAt: timestamp,
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

// ─── Writing Sprint ─────────────────────────────────────────────────

const SprintStatusEnum = z.enum(["active", "paused", "completed", "abandoned"]);

export const WritingSprintSchema = z.object({
  id: WritingSprintIdSchema,
  projectId: ProjectIdSchema.nullable().default(null),
  chapterId: ChapterIdSchema.nullable().default(null),
  durationMs: z.number().int().positive(),
  wordCountGoal: z.number().int().nonnegative().nullable().default(null),
  status: SprintStatusEnum,
  startedAt: timestamp,
  pausedAt: timestamp.nullable().default(null),
  endedAt: timestamp.nullable().default(null),
  totalPausedMs: z.number().int().nonnegative().default(0),
  startWordCount: z.number().int().nonnegative(),
  endWordCount: z.number().int().nonnegative().nullable().default(null),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type WritingSprint = z.infer<typeof WritingSprintSchema>;

// ─── Writing Session ────────────────────────────────────────────────

export const WritingSessionSchema = z.object({
  id: WritingSessionIdSchema,
  projectId: ProjectIdSchema,
  chapterId: ChapterIdSchema,
  date: z.string(), // YYYY-MM-DD for easy grouping
  hourOfDay: z.number().int().min(0).max(23), // 0-23 for time-of-day analysis
  wordCountStart: z.number().int().nonnegative(),
  wordCountEnd: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type WritingSession = z.infer<typeof WritingSessionSchema>;

// ─── Playlist Track ──────────────────────────────────────────────────

const TrackSourceSchema = z.enum(["youtube"]);
export type TrackSource = z.infer<typeof TrackSourceSchema>;

export const PlaylistTrackSchema = z.object({
  id: PlaylistTrackIdSchema,
  projectId: ProjectIdSchema,
  title: z.string().min(1),
  url: z.string().url(),
  source: TrackSourceSchema,
  thumbnailUrl: z.string().default(""),
  duration: z.number().int().nonnegative().default(0),
  order: z.number().int().nonnegative(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type PlaylistTrack = z.infer<typeof PlaylistTrackSchema>;

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

// ─── Comment ─────────────────────────────────────────────────────────

const CommentColorEnum = z.enum(["yellow", "blue", "green", "red", "purple"]);
export type CommentColor = z.infer<typeof CommentColorEnum>;

const CommentStatusEnum = z.enum(["active", "orphaned", "resolved"]);
export type CommentStatus = z.infer<typeof CommentStatusEnum>;

export const CommentSchema = z.object({
  id: CommentIdSchema,
  projectId: ProjectIdSchema,
  chapterId: ChapterIdSchema,
  content: z.string().default(""),
  color: CommentColorEnum.default("yellow"),
  fromOffset: z.number().int().nonnegative(),
  toOffset: z.number().int().nonnegative(), // from === to for positioned (point) comments
  anchorText: z.string().default(""), // Empty for positioned (point) comments
  status: CommentStatusEnum.default("active"),
  resolvedAt: timestamp.nullable().default(null),
  // Optional: present on comments authored during a collab session.
  // Display name + caret color of the author at creation time.
  author: z.string().optional(),
  authorColor: z.string().optional(),
  // Threading. null = root comment; non-null = reply attached to that root.
  // Replies are flat: a reply's own parentCommentId always points at a root,
  // never at another reply. Replies inherit their position (fromOffset /
  // toOffset / anchorText) from the root at creation time and stay in sync
  // when the root moves.
  parentCommentId: CommentIdSchema.nullable().default(null),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Comment = z.infer<typeof CommentSchema>;

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

// ─── Indexed Chunk (vector retrieval) ───────────────────────────────

const IndexedChunkSourceTypeEnum = z.enum(["worldbuilding", "chapter"]);
export type IndexedChunkSourceType = z.infer<typeof IndexedChunkSourceTypeEnum>;

export const IndexedChunkSchema = z.object({
  id: IndexedChunkIdSchema,
  projectId: ProjectIdSchema,
  sourceType: IndexedChunkSourceTypeEnum,
  /** WorldbuildingDocId or ChapterId of the chunk's source. */
  sourceId: z.string(),
  chunkIndex: z.number().int().nonnegative(),
  text: z.string(),
  contentHash: z.string(),
  vector: z.array(z.number()),
  /** EmbeddingProvider.id used — re-embed when it changes. */
  embeddingModel: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type IndexedChunk = z.infer<typeof IndexedChunkSchema>;

// ─── Settings Normalization ─────────────────────────────────────────

/** Convert old per-provider API key fields to the new record format. */
export function normalizeAppSettings(
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (data.providerApiKeys && data.providerModels) return data;

  const result = { ...data };

  if (!result.providerApiKeys) {
    result.providerApiKeys = {
      openrouter: (result.openRouterApiKey as string) ?? "",
      anthropic: (result.anthropicApiKey as string) ?? "",
      openai: (result.openAiApiKey as string) ?? "",
      grok: (result.grokApiKey as string) ?? "",
      zai: (result.zaiApiKey as string) ?? "",
    };
  }

  if (!result.providerModels) {
    result.providerModels = {
      openrouter: (result.preferredModel as string) ?? "openai/gpt-4o",
      anthropic: "claude-sonnet-4-5-20250929",
      openai: "gpt-4o",
      grok: "grok-3",
      zai: "glm-4.7",
    };
  }

  delete result.openRouterApiKey;
  delete result.anthropicApiKey;
  delete result.openAiApiKey;
  delete result.grokApiKey;
  delete result.zaiApiKey;
  delete result.preferredModel;

  return result;
}
