import { z } from "zod/v4";

// ─── Shared Primitives ───────────────────────────────────────────────

const id = z.uuid();
const timestamp = z.iso.datetime();
const projectFk = z.uuid();

// ─── Project Mode ───────────────────────────────────────────────────

export const ProjectModeEnum = z.enum(["prose", "screenplay"]);
export type ProjectMode = z.infer<typeof ProjectModeEnum>;

// ─── Project ─────────────────────────────────────────────────────────

export const ProjectSchema = z.object({
  id,
  title: z.string().min(1),
  description: z.string().default(""),
  genre: z.string().default(""),
  targetWordCount: z.number().int().nonnegative().default(0),
  mode: ProjectModeEnum.default("prose"),
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

// ─── Entity Image ───────────────────────────────────────────────────

export const EntityImageSchema = z.object({
  id: z.uuid(),
  url: z.string().url(),
  caption: z.string().default(""),
  isPrimary: z.boolean().default(false),
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
  id,
  projectId: projectFk,
  name: z.string().min(1),
  role: CharacterRoleEnum.default("supporting"),
  pronouns: z.string().default(""),
  aliases: z.array(z.string()).default([]),
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
  linkedCharacterIds: z.array(z.uuid()).default([]),
  linkedLocationIds: z.array(z.uuid()).default([]),
  images: z.array(EntityImageSchema).default([]),
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
  images: z.array(EntityImageSchema).default([]),
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

// ─── App Dictionary (singleton) ─────────────────────────────────────

export const AppDictionarySchema = z.object({
  id: z.literal("app-dictionary"),
  words: z.array(z.string()).default([]),
  updatedAt: timestamp,
});
export type AppDictionary = z.infer<typeof AppDictionarySchema>;

// ─── Project Dictionary ─────────────────────────────────────────────

export const ProjectDictionarySchema = z.object({
  id,
  projectId: projectFk,
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
  id,
  projectId: projectFk,
  title: z.string().min(1),
  order: z.number().int().nonnegative(),
  width: z.number().int().positive().default(200),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type OutlineGridColumn = z.infer<typeof OutlineGridColumnSchema>;

// ─── Outline Grid Row ───────────────────────────────────────────────

export const OutlineGridRowSchema = z.object({
  id,
  projectId: projectFk,
  linkedChapterId: z.uuid().nullable().default(null),
  label: z.string().default(""),
  order: z.number().int().nonnegative(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type OutlineGridRow = z.infer<typeof OutlineGridRowSchema>;

// ─── Outline Grid Cell ──────────────────────────────────────────────

export const OutlineGridCellSchema = z.object({
  id,
  projectId: projectFk,
  rowId: z.uuid(),
  columnId: z.uuid(),
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

export const ReasoningEffortEnum = z.enum([
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
 * Built-in pipeline agent kinds. Each can have its own model override
 * configured via AppSettings.agentModelOverrides; null falls back to the
 * global aiProvider/providerModels.
 */
export const AgentKindEnum = z.enum([
  "reader",
  "orchestrator",
  "editor",
  "verifier",
]);
export type AgentKind = z.infer<typeof AgentKindEnum>;

export const AgentModelOverrideSchema = z.object({
  provider: AiProviderEnum,
  model: z.string().min(1),
  reasoningEffort: ReasoningEffortEnum.optional(),
});
export type AgentModelOverride = z.infer<typeof AgentModelOverrideSchema>;

/**
 * User-defined agent. Saved configuration for a custom AI workflow — system
 * prompt + tool subset + optional model override + optional per-tool prompt
 * override. Invoked from the AiPanel as an alternative to the legacy
 * task-tool selector. Phase 4 polish.
 */
export const CustomAgentSchema = z.object({
  id,
  /** Per-project so they back up with the project. */
  projectId: projectFk.nullable().default(null),
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
export type CustomAgent = z.infer<typeof CustomAgentSchema>;

// ─── App Settings (singleton) ────────────────────────────────────────

export const PrimaryColorEnum = z.enum([
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

export const NeutralColorEnum = z.enum([
  "zinc",
  "slate",
  "gray",
  "stone",
  "neutral",
]);
export type NeutralColor = z.infer<typeof NeutralColorEnum>;

export const EditorWidthEnum = z.enum(["narrow", "medium", "wide"]);
export type EditorWidth = z.infer<typeof EditorWidthEnum>;

export const UiDensityEnum = z.enum(["compact", "comfortable"]);
export type UiDensity = z.infer<typeof UiDensityEnum>;

export const GoalCountdownDisplayEnum = z.enum([
  "estimated-date",
  "time-remaining",
  "off",
]);
export type GoalCountdownDisplay = z.infer<typeof GoalCountdownDisplayEnum>;

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
  theme: z.enum(["light", "dark", "system"]).default("system"),
  primaryColor: PrimaryColorEnum.default("blue"),
  neutralColor: NeutralColorEnum.default("zinc"),
  editorWidth: EditorWidthEnum.default("medium"),
  uiDensity: UiDensityEnum.default("comfortable"),
  autoSaveIntervalMs: z.number().int().positive().default(3000),
  editorFontSize: z.number().int().positive().default(16),
  editorFont: z.string().default("literata"),
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
  agentModelOverrides: z
    .record(AgentKindEnum, AgentModelOverrideSchema.nullable())
    .default({
      reader: null,
      orchestrator: null,
      editor: null,
      verifier: null,
    }),
  customSystemPrompt: z.string().nullable().default(null),
  disabledBuiltinTools: z.array(z.string()).default([]),
  builtinToolOverrides: z.record(z.string(), z.string()).default({}),
  customTools: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1),
        prompt: z.string().min(1),
      }),
    )
    .default([]),
  lastExportedAt: z.string().datetime().nullable().default(null),
  updatedAt: timestamp,
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

// ─── Writing Sprint ─────────────────────────────────────────────────

export const SprintStatusEnum = z.enum([
  "active",
  "paused",
  "completed",
  "abandoned",
]);
export type SprintStatus = z.infer<typeof SprintStatusEnum>;

export const WritingSprintSchema = z.object({
  id,
  projectId: projectFk.nullable().default(null),
  chapterId: z.uuid().nullable().default(null),
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
  id,
  projectId: projectFk,
  chapterId: z.uuid(),
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

export const TrackSourceSchema = z.enum(["youtube"]);
export type TrackSource = z.infer<typeof TrackSourceSchema>;

export const PlaylistTrackSchema = z.object({
  id,
  projectId: projectFk,
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
  id,
  chapterId: z.string().uuid(),
  projectId: projectFk,
  name: z.string().min(1),
  content: z.string(),
  wordCount: z.number().int().nonnegative(),
  createdAt: timestamp,
});
export type ChapterSnapshot = z.infer<typeof ChapterSnapshotSchema>;

// ─── Comment ─────────────────────────────────────────────────────────

export const CommentColorEnum = z.enum([
  "yellow",
  "blue",
  "green",
  "red",
  "purple",
]);
export type CommentColor = z.infer<typeof CommentColorEnum>;

export const CommentStatusEnum = z.enum(["active", "orphaned", "resolved"]);
export type CommentStatus = z.infer<typeof CommentStatusEnum>;

export const CommentSchema = z.object({
  id,
  projectId: projectFk,
  chapterId: z.uuid(),
  content: z.string().default(""),
  color: CommentColorEnum.default("yellow"),
  fromOffset: z.number().int().nonnegative(),
  toOffset: z.number().int().nonnegative(), // from === to for positioned (point) comments
  anchorText: z.string().default(""), // Empty for positioned (point) comments
  status: CommentStatusEnum.default("active"),
  resolvedAt: timestamp.nullable().default(null),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Comment = z.infer<typeof CommentSchema>;

// ─── Agent Pipeline ──────────────────────────────────────────────────
//
// Tables that back the manuscript review/edit pipeline (Reader → Orchestrator
// → Editor → Verifier). Phase 1 uses agentRuns, readerBibleLog/View, agentNotes,
// agentQuestions; Phase 2+ uses workUnits, editPlans, proposedEdits, etc. All
// declared here in one v26 migration to avoid disturbance migrations later.
//
// Strict separation from the authored bible: pipeline tools never read or
// write Character/Location/etc. tables. The reader builds its model purely
// from manuscript text via `read_chapter` / `search_*`.

// Top-level paths the Reader is allowed to write under. Anything else is
// rejected by `bible_write` to prevent the model from inventing structure.
export const READER_BIBLE_TOP_LEVEL_PATHS = [
  "characters",
  "locations",
  "factions",
  "rules",
  "timeline",
  "voice",
  "open_threads",
  "reader_knowledge",
] as const;

export const ReaderBibleOpEnum = z.enum(["set", "merge", "delete"]);
export type ReaderBibleOp = z.infer<typeof ReaderBibleOpEnum>;

/** Append-only entry recording every reader-bible mutation. */
export const ReaderBibleLogEntrySchema = z.object({
  id,
  projectId: projectFk,
  runId: z.uuid(),
  /** Slash-segmented path under one of READER_BIBLE_TOP_LEVEL_PATHS. */
  path: z.string().min(1),
  op: ReaderBibleOpEnum,
  /** JSON value for set/merge ops. Ignored for delete. */
  value: z.unknown().optional(),
  /** Chapter index (1-based) the reader had processed when writing. */
  asOfChapter: z.number().int().nonnegative().nullable().default(null),
  /** Optional pointer back to the agent message that produced this entry. */
  agentMessageId: z.string().nullable().default(null),
  createdAt: timestamp,
});
export type ReaderBibleLogEntry = z.infer<typeof ReaderBibleLogEntrySchema>;

/** Materialized current view per (projectId, path). */
export const ReaderBibleViewEntrySchema = z.object({
  id,
  projectId: projectFk,
  path: z.string().min(1),
  value: z.unknown(),
  lastUpdatedAt: timestamp,
  lastLogEntryId: z.string(),
});
export type ReaderBibleViewEntry = z.infer<typeof ReaderBibleViewEntrySchema>;

export const AgentNoteCategoryEnum = z.enum([
  "plot",
  "character",
  "continuity",
  "voice",
  "pacing",
  "prose",
  "worldbuilding",
  "theme",
  "other",
]);
export type AgentNoteCategory = z.infer<typeof AgentNoteCategoryEnum>;

export const AgentNoteSeverityEnum = z.enum([
  "blocker",
  "major",
  "minor",
  "nit",
]);
export type AgentNoteSeverity = z.infer<typeof AgentNoteSeverityEnum>;

export const AgentNoteStatusEnum = z.enum(["open", "addressed", "dismissed"]);
export type AgentNoteStatus = z.infer<typeof AgentNoteStatusEnum>;

export const AgentReferenceKindEnum = z.enum(["chapter", "bible", "note"]);
export const AgentReferenceSchema = z.object({
  kind: AgentReferenceKindEnum,
  id: z.string(),
  /** Optional locator (e.g. paragraph index, anchor text snippet). */
  locator: z.string().optional(),
});
export type AgentReference = z.infer<typeof AgentReferenceSchema>;

export const AgentNoteSchema = z.object({
  id,
  projectId: projectFk,
  runId: z.uuid(),
  /** Optional anchor chapter; null = global / cross-cutting. */
  chapterId: z.uuid().nullable().default(null),
  category: AgentNoteCategoryEnum,
  severity: AgentNoteSeverityEnum,
  description: z.string().min(1),
  references: z.array(AgentReferenceSchema).default([]),
  status: AgentNoteStatusEnum.default("open"),
  /** Set by orchestrator when a work unit takes responsibility for this note. */
  addressedByWorkUnitId: z.uuid().nullable().default(null),
  /** Set when the note was generated by a verifier finding. */
  sourceVerificationId: z.uuid().nullable().default(null),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type AgentNote = z.infer<typeof AgentNoteSchema>;

export const AgentQuestionStatusEnum = z.enum([
  "open",
  "answered",
  "dismissed",
]);
export type AgentQuestionStatus = z.infer<typeof AgentQuestionStatusEnum>;

export const AgentQuestionSchema = z.object({
  id,
  projectId: projectFk,
  runId: z.uuid(),
  description: z.string().min(1),
  references: z.array(AgentReferenceSchema).default([]),
  status: AgentQuestionStatusEnum.default("open"),
  humanAnswer: z.string().nullable().default(null),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type AgentQuestion = z.infer<typeof AgentQuestionSchema>;

export const WorkUnitStatusEnum = z.enum([
  "planned",
  "in-progress",
  "awaiting-approval",
  "approved",
  "rejected",
  "applied",
  "superseded",
]);
export type WorkUnitStatus = z.infer<typeof WorkUnitStatusEnum>;

export const WorkUnitPlacementSchema = z.object({
  chapterId: z.uuid(),
  position: z.enum(["before", "after", "replace", "insert-at"]),
  anchorText: z.string().optional(),
  paragraphIndex: z.number().int().nonnegative().optional(),
  pov: z.string().optional(),
});
export type WorkUnitPlacement = z.infer<typeof WorkUnitPlacementSchema>;

export const WorkUnitSchema = z.object({
  id,
  projectId: projectFk,
  runId: z.uuid(),
  tier: z.number().int().nonnegative(),
  goal: z.string().min(1),
  requiredBeats: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  placement: WorkUnitPlacementSchema,
  targetLengthWords: z.number().int().nonnegative().nullable().default(null),
  bibleRefs: z.array(z.string()).default([]),
  sourceNoteIds: z.array(z.uuid()).default([]),
  /** Other work-unit ids that must apply before this one. */
  dependencies: z.array(z.uuid()).default([]),
  status: WorkUnitStatusEnum.default("planned"),
  ownerEditorMessageId: z.string().nullable().default(null),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type WorkUnit = z.infer<typeof WorkUnitSchema>;

export const EditPlanStatusEnum = z.enum(["draft", "approved", "superseded"]);
export type EditPlanStatus = z.infer<typeof EditPlanStatusEnum>;

export const EditPlanTierSchema = z.object({
  tierNumber: z.number().int().nonnegative(),
  summary: z.string().default(""),
  workUnitIds: z.array(z.uuid()).default([]),
});
export type EditPlanTier = z.infer<typeof EditPlanTierSchema>;

export const EditPlanSchema = z.object({
  id,
  projectId: projectFk,
  runId: z.uuid(),
  status: EditPlanStatusEnum.default("draft"),
  currentTier: z.number().int().nonnegative().default(0),
  tiers: z.array(EditPlanTierSchema).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type EditPlan = z.infer<typeof EditPlanSchema>;

export const ProposedEditKindEnum = z.enum([
  "replace_range",
  "insert_at",
  "append",
  "full_chapter",
]);
export type ProposedEditKind = z.infer<typeof ProposedEditKindEnum>;

export const ProposedEditStatusEnum = z.enum([
  "pending",
  "approved",
  "rejected",
  "applied",
  "discarded",
]);
export type ProposedEditStatus = z.infer<typeof ProposedEditStatusEnum>;

export const ProposedEditSchema = z.object({
  id,
  projectId: projectFk,
  runId: z.uuid(),
  workUnitId: z.uuid(),
  chapterId: z.uuid(),
  kind: ProposedEditKindEnum,
  fromOffset: z.number().int().nonnegative().optional(),
  toOffset: z.number().int().nonnegative().optional(),
  /** Resilient anchor: searched if (fromOffset,toOffset) no longer match. */
  anchorText: z.string().optional(),
  newContent: z.string(),
  rationale: z.string().default(""),
  status: ProposedEditStatusEnum.default("pending"),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type ProposedEdit = z.infer<typeof ProposedEditSchema>;

export const VerificationFindingSchema = z.object({
  description: z.string().min(1),
  references: z.array(AgentReferenceSchema).default([]),
});
export type VerificationFinding = z.infer<typeof VerificationFindingSchema>;

export const VerificationSchema = z.object({
  id,
  projectId: projectFk,
  runId: z.uuid(),
  tier: z.number().int().nonnegative(),
  /** Null = tier-wide drift verification. */
  workUnitId: z.uuid().nullable().default(null),
  goalAchieved: z.boolean(),
  contradictions: z.array(VerificationFindingSchema).default([]),
  continuityBreaks: z.array(VerificationFindingSchema).default([]),
  voiceMismatches: z.array(VerificationFindingSchema).default([]),
  notes: z.array(z.string()).default([]),
  createdAt: timestamp,
});
export type Verification = z.infer<typeof VerificationSchema>;

export const AgentRunStatusEnum = z.enum([
  "idle",
  "reading",
  "planning",
  "awaiting-plan-approval",
  "executing-tier",
  "awaiting-edit-approval",
  "applying-tier",
  "verifying-tier",
  "complete",
  "cancelled",
  "error",
]);
export type AgentRunStatus = z.infer<typeof AgentRunStatusEnum>;

export const ReaderPassSchema = z.object({
  passNumber: z.number().int().positive(),
  startedAt: timestamp,
  completedAt: timestamp.nullable().default(null),
  newBibleEntries: z.number().int().nonnegative().default(0),
  newNotes: z.number().int().nonnegative().default(0),
  newQuestions: z.number().int().nonnegative().default(0),
});
export type ReaderPass = z.infer<typeof ReaderPassSchema>;

export const AgentRunUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative().default(0),
  completionTokens: z.number().int().nonnegative().default(0),
});
export type AgentRunUsage = z.infer<typeof AgentRunUsageSchema>;

export const AgentRunSchema = z.object({
  id,
  projectId: projectFk,
  name: z.string().min(1),
  status: AgentRunStatusEnum.default("idle"),
  currentTier: z.number().int().nonnegative().default(0),
  currentSnapshotManifestId: z.uuid().nullable().default(null),
  readerPasses: z.array(ReaderPassSchema).default([]),
  /** Snapshot of agent model overrides at run-creation time. */
  modelOverrides: z
    .record(AgentKindEnum, AgentModelOverrideSchema.nullable())
    .default({
      reader: null,
      orchestrator: null,
      editor: null,
      verifier: null,
    }),
  /** Hard cap; pipeline auto-pauses when totalTokenUsage exceeds this. */
  budgetTokens: z.number().int().positive().default(1_000_000),
  totalTokenUsage: AgentRunUsageSchema.default({
    promptTokens: 0,
    completionTokens: 0,
  }),
  /**
   * Set true when verifier surfaces drift; UI requires an incremental Reader
   * pass before the next plan-approval gate unlocks.
   */
  requiresIncrementalReread: z.boolean().default(false),
  /** Last status-change reason — surfaced in UI banners. */
  statusReason: z.string().nullable().default(null),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type AgentRun = z.infer<typeof AgentRunSchema>;

export const ChapterSummarySchema = z.object({
  id,
  projectId: projectFk,
  chapterId: z.uuid(),
  /** sha-256 of the source chapter content; mismatch invalidates the row. */
  sourceContentHash: z.string().min(1),
  summary: z.string(),
  createdAt: timestamp,
});
export type ChapterSummary = z.infer<typeof ChapterSummarySchema>;

export const SnapshotManifestSchema = z.object({
  id,
  projectId: projectFk,
  runId: z.uuid(),
  tierNumber: z.number().int().nonnegative(),
  name: z.string().min(1),
  /** FKs into existing chapterSnapshots — manifests don't duplicate storage. */
  chapterSnapshotIds: z.array(z.uuid()).default([]),
  /** Inline snapshot of the reader bible at the moment of manifest creation. */
  readerBibleSnapshot: z.object({
    view: z.array(ReaderBibleViewEntrySchema).default([]),
    logCutoffEntryId: z.string().nullable().default(null),
  }),
  notesSnapshot: z.array(AgentNoteSchema).default([]),
  workUnitsSnapshot: z.array(WorkUnitSchema).default([]),
  createdAt: timestamp,
});
export type SnapshotManifest = z.infer<typeof SnapshotManifestSchema>;

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
