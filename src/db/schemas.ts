import { z } from "zod/v4";

// ─── Shared Primitives ───────────────────────────────────────────────

const timestamp = z.iso.datetime();

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

export const CharacterIdSchema = z.uuid().brand<"CharacterId">();
export type CharacterId = z.infer<typeof CharacterIdSchema>;

export const LocationIdSchema = z.uuid().brand<"LocationId">();
export type LocationId = z.infer<typeof LocationIdSchema>;

export const TimelineEventIdSchema = z.uuid().brand<"TimelineEventId">();
export type TimelineEventId = z.infer<typeof TimelineEventIdSchema>;

export const StyleGuideEntryIdSchema = z.uuid().brand<"StyleGuideEntryId">();
export type StyleGuideEntryId = z.infer<typeof StyleGuideEntryIdSchema>;

export const WorldbuildingDocIdSchema = z.uuid().brand<"WorldbuildingDocId">();
export type WorldbuildingDocId = z.infer<typeof WorldbuildingDocIdSchema>;

export const CharacterRelationshipIdSchema = z
  .uuid()
  .brand<"CharacterRelationshipId">();
export type CharacterRelationshipId = z.infer<
  typeof CharacterRelationshipIdSchema
>;

export const OutlineGridColumnIdSchema = z
  .uuid()
  .brand<"OutlineGridColumnId">();
export type OutlineGridColumnId = z.infer<typeof OutlineGridColumnIdSchema>;

export const OutlineGridRowIdSchema = z.uuid().brand<"OutlineGridRowId">();
export type OutlineGridRowId = z.infer<typeof OutlineGridRowIdSchema>;

export const OutlineGridCellIdSchema = z.uuid().brand<"OutlineGridCellId">();
export type OutlineGridCellId = z.infer<typeof OutlineGridCellIdSchema>;

export const WritingSprintIdSchema = z.uuid().brand<"WritingSprintId">();
export type WritingSprintId = z.infer<typeof WritingSprintIdSchema>;

export const WritingSessionIdSchema = z.uuid().brand<"WritingSessionId">();
export type WritingSessionId = z.infer<typeof WritingSessionIdSchema>;

export const PlaylistTrackIdSchema = z.uuid().brand<"PlaylistTrackId">();
export type PlaylistTrackId = z.infer<typeof PlaylistTrackIdSchema>;

export const CommentIdSchema = z.uuid().brand<"CommentId">();
export type CommentId = z.infer<typeof CommentIdSchema>;

export const ChapterSnapshotIdSchema = z.uuid().brand<"ChapterSnapshotId">();
export type ChapterSnapshotId = z.infer<typeof ChapterSnapshotIdSchema>;

export const ProjectDictionaryIdSchema = z
  .uuid()
  .brand<"ProjectDictionaryId">();
export type ProjectDictionaryId = z.infer<typeof ProjectDictionaryIdSchema>;

export const AgentRunIdSchema = z.uuid().brand<"AgentRunId">();
export type AgentRunId = z.infer<typeof AgentRunIdSchema>;

export const ReaderBibleLogEntryIdSchema = z
  .uuid()
  .brand<"ReaderBibleLogEntryId">();
export type ReaderBibleLogEntryId = z.infer<typeof ReaderBibleLogEntryIdSchema>;

export const ReaderBibleViewEntryIdSchema = z
  .uuid()
  .brand<"ReaderBibleViewEntryId">();
export type ReaderBibleViewEntryId = z.infer<
  typeof ReaderBibleViewEntryIdSchema
>;

export const AgentNoteIdSchema = z.uuid().brand<"AgentNoteId">();
export type AgentNoteId = z.infer<typeof AgentNoteIdSchema>;

export const AgentQuestionIdSchema = z.uuid().brand<"AgentQuestionId">();
export type AgentQuestionId = z.infer<typeof AgentQuestionIdSchema>;

export const WorkUnitIdSchema = z.uuid().brand<"WorkUnitId">();
export type WorkUnitId = z.infer<typeof WorkUnitIdSchema>;

export const EditPlanIdSchema = z.uuid().brand<"EditPlanId">();
export type EditPlanId = z.infer<typeof EditPlanIdSchema>;

export const ProposedEditIdSchema = z.uuid().brand<"ProposedEditId">();
export type ProposedEditId = z.infer<typeof ProposedEditIdSchema>;

export const VerificationIdSchema = z.uuid().brand<"VerificationId">();
export type VerificationId = z.infer<typeof VerificationIdSchema>;

export const ChapterSummaryIdSchema = z.uuid().brand<"ChapterSummaryId">();
export type ChapterSummaryId = z.infer<typeof ChapterSummaryIdSchema>;

export const SnapshotManifestIdSchema = z.uuid().brand<"SnapshotManifestId">();
export type SnapshotManifestId = z.infer<typeof SnapshotManifestIdSchema>;

export const AgentDefinitionIdSchema = z.uuid().brand<"AgentDefinitionId">();
export type AgentDefinitionId = z.infer<typeof AgentDefinitionIdSchema>;

export const EntityImageIdSchema = z.uuid().brand<"EntityImageId">();
export type EntityImageId = z.infer<typeof EntityImageIdSchema>;

export const IndexedChunkIdSchema = z.uuid().brand<"IndexedChunkId">();
export type IndexedChunkId = z.infer<typeof IndexedChunkIdSchema>;

// ─── Project Mode ───────────────────────────────────────────────────

export const ProjectModeEnum = z.enum(["prose", "screenplay"]);
export type ProjectMode = z.infer<typeof ProjectModeEnum>;

// ─── Project ─────────────────────────────────────────────────────────

export const ProjectSchema = z.object({
  id: ProjectIdSchema,
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

// Binder taxonomy (v37). A chapter row is either a real `document` (holds prose
// and may nest children) or a `separator` (a label marker dividing siblings).
export const ChapterKindEnum = z.enum(["document", "separator"]);
export type ChapterKind = z.infer<typeof ChapterKindEnum>;

// `manuscript` rows compile into the book; `scratchpad` rows are loose storage
// that never compiles and never counts toward the manuscript word count.
export const ChapterSectionEnum = z.enum(["manuscript", "scratchpad"]);
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
  // ── Binder hierarchy (v37) ──
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

// ─── Entity Image ───────────────────────────────────────────────────

export const EntityImageSchema = z.object({
  id: EntityImageIdSchema,
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
  id: CharacterIdSchema,
  projectId: ProjectIdSchema,
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
  linkedCharacterIds: z.array(CharacterIdSchema).default([]),
  linkedLocationIds: z.array(LocationIdSchema).default([]),
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
  id: StyleGuideEntryIdSchema,
  projectId: ProjectIdSchema,
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
 * Pipeline-internal agent kinds. These run inside the manuscript review/edit
 * pipeline (Reader → Orchestrator → Editor → Verifier). Reader and Editor are
 * also exposed in the AiPanel chat dropdown via their corresponding chat-mode
 * agent rows; Orchestrator and Verifier are not user-selectable.
 */
export const PipelineAgentKindEnum = z.enum([
  "reader",
  "orchestrator",
  "editor",
  "verifier",
]);
export type PipelineAgentKind = z.infer<typeof PipelineAgentKindEnum>;

/**
 * All agent kinds: chat-mode user-facing agents, pipeline-internal agents
 * (orchestrator, verifier), and user-created agents. Reader/Editor appear in
 * BOTH the user-facing set (chat mode) and the pipeline-internal set — the
 * agent row is shared between the two execution paths.
 */
export const AgentKindEnum = z.enum([
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
  // Pipeline-internal (not user-selectable from chat).
  "orchestrator",
  "verifier",
  // User-created via Manage Agents.
  "user",
]);
export type AgentKind = z.infer<typeof AgentKindEnum>;

/** Pipeline kinds as a const set for runtime checks. */
export const PIPELINE_AGENT_KINDS: ReadonlySet<AgentKind> = new Set([
  "reader",
  "orchestrator",
  "editor",
  "verifier",
]);

/** Kinds exposed in the AiPanel chat dropdown. */
export const CHAT_AGENT_KINDS: ReadonlySet<AgentKind> = new Set([
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
  "user",
]);

export const AgentModelOverrideSchema = z.object({
  provider: AiProviderEnum,
  model: z.string().min(1),
  reasoningEffort: ReasoningEffortEnum.optional(),
});
export type AgentModelOverride = z.infer<typeof AgentModelOverrideSchema>;

/**
 * Unified agent definition row. Backs both the seven user-facing chat agents
 * (spark, scene, reader, editor, character-dialogue, brainstorm, chat), the
 * two pipeline-internal agents (orchestrator, verifier), and any user-created
 * agents (kind="user"). Fields are seeded from bundled defaults when a
 * built-in agent is first written; "Reset to defaults" rewrites them.
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

export const SavedPromptIdSchema = z.uuid().brand<"SavedPromptId">();
export type SavedPromptId = z.infer<typeof SavedPromptIdSchema>;

export const SavedPromptSchema = z.object({
  id: SavedPromptIdSchema,
  // null = global (available in every project); otherwise scoped to a project.
  projectId: ProjectIdSchema.nullable().default(null),
  title: z.string().min(1),
  body: z.string().default(""),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type SavedPrompt = z.infer<typeof SavedPromptSchema>;

// ─── Brainstorm ──────────────────────────────────────────────────────

export const BrainstormSetupIdSchema = z.uuid().brand<"BrainstormSetupId">();
export type BrainstormSetupId = z.infer<typeof BrainstormSetupIdSchema>;

export const BrainstormIdeaIdSchema = z.uuid().brand<"BrainstormIdeaId">();
export type BrainstormIdeaId = z.infer<typeof BrainstormIdeaIdSchema>;

// A named column is a list of string options. Columns are embedded in their
// setup (meaningless on their own, always edited together), not a table.
export const BrainstormColumnSchema = z.object({
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

/**
 * Delimiters wrapping a "hole" — a section the author intentionally skips,
 * usually holding a plaintext summary. See `src/lib/holes.ts`.
 */
export const HoleDelimitersSchema = z.object({
  open: z.string().min(1).default("["),
  close: z.string().min(1).default("]"),
});
export type HoleDelimiters = z.infer<typeof HoleDelimitersSchema>;

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
  debugMode: z.boolean().default(false),
  streamResponses: z.boolean().default(true),
  reasoningEffort: ReasoningEffortEnum.default("medium"),
  readingSpeedWpm: z.number().int().positive().default(200),
  autoFocusModeOnSprint: z.boolean().default(false),
  goalCountdownDisplay: GoalCountdownDisplayEnum.default("estimated-date"),
  postChatInstructions: z.string().default(""),
  postChatInstructionsDepth: z.number().int().nonnegative().default(2),
  assistantPrefill: z.string().default(""),
  /**
   * Per-iteration prompt-token threshold above which the comprehension pass
   * soft-resets — ends the current segment and starts a fresh one at the
   * next chapter with empty history. The reader bible carries forward.
   */
  comprehensionContextThreshold: z.number().int().positive().default(80_000),
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

export const SprintStatusEnum = z.enum([
  "active",
  "paused",
  "completed",
  "abandoned",
]);
export type SprintStatus = z.infer<typeof SprintStatusEnum>;

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

export const TrackSourceSchema = z.enum(["youtube"]);
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
  // Thematic reader namespaces. Motifs are recurring concrete imagery; symbols
  // are motifs promoted with an interpretive claim and ≥2 grounded occurrences;
  // subtext covers what surface scenes are *also* about (juxtapositions,
  // omissions live as sub-keys here).
  "motifs",
  "symbols",
  "subtext",
] as const;

export const ReaderBibleOpEnum = z.enum(["set", "merge", "delete"]);
export type ReaderBibleOp = z.infer<typeof ReaderBibleOpEnum>;

/** Append-only entry recording every reader-bible mutation. */
export const ReaderBibleLogEntrySchema = z.object({
  id: ReaderBibleLogEntryIdSchema,
  projectId: ProjectIdSchema,
  runId: AgentRunIdSchema,
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

/** Materialized current view per (runId, path). Bibles are scoped per agent
 * run so reading-passes from one run never leak into another run's context. */
export const ReaderBibleViewEntrySchema = z.object({
  id: ReaderBibleViewEntryIdSchema,
  projectId: ProjectIdSchema,
  runId: AgentRunIdSchema,
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
  id: AgentNoteIdSchema,
  projectId: ProjectIdSchema,
  runId: AgentRunIdSchema,
  /** Optional anchor chapter; null = global / cross-cutting. */
  chapterId: ChapterIdSchema.nullable().default(null),
  category: AgentNoteCategoryEnum,
  severity: AgentNoteSeverityEnum,
  description: z.string().min(1),
  references: z.array(AgentReferenceSchema).default([]),
  status: AgentNoteStatusEnum.default("open"),
  /** Set by orchestrator when a work unit takes responsibility for this note. */
  addressedByWorkUnitId: WorkUnitIdSchema.nullable().default(null),
  /** Set when the note was generated by a verifier finding. */
  sourceVerificationId: VerificationIdSchema.nullable().default(null),
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
  id: AgentQuestionIdSchema,
  projectId: ProjectIdSchema,
  runId: AgentRunIdSchema,
  description: z.string().min(1),
  references: z.array(AgentReferenceSchema).default([]),
  status: AgentQuestionStatusEnum.default("open"),
  humanAnswer: z.string().nullable().default(null),
  /**
   * Resolution proposed by a self-answer reader pass. The question stays
   * `open` until a human ratifies the proposal — agents are advisory.
   */
  proposedAnswer: z.string().nullable().default(null),
  proposedAt: timestamp.nullable().default(null),
  proposedByPassNumber: z.number().int().positive().nullable().default(null),
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
  chapterId: ChapterIdSchema,
  position: z.enum(["before", "after", "replace", "insert-at"]),
  anchorText: z.string().optional(),
  paragraphIndex: z.number().int().nonnegative().optional(),
  pov: z.string().optional(),
});
export type WorkUnitPlacement = z.infer<typeof WorkUnitPlacementSchema>;

export const WorkUnitSchema = z.object({
  id: WorkUnitIdSchema,
  projectId: ProjectIdSchema,
  runId: AgentRunIdSchema,
  tier: z.number().int().nonnegative(),
  goal: z.string().min(1),
  requiredBeats: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  placement: WorkUnitPlacementSchema,
  targetLengthWords: z.number().int().nonnegative().nullable().default(null),
  bibleRefs: z.array(z.string()).default([]),
  sourceNoteIds: z.array(AgentNoteIdSchema).default([]),
  /** Other work-unit ids that must apply before this one. */
  dependencies: z.array(WorkUnitIdSchema).default([]),
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
  workUnitIds: z.array(WorkUnitIdSchema).default([]),
});
export type EditPlanTier = z.infer<typeof EditPlanTierSchema>;

export const EditPlanSchema = z.object({
  id: EditPlanIdSchema,
  projectId: ProjectIdSchema,
  runId: AgentRunIdSchema,
  status: EditPlanStatusEnum.default("draft"),
  currentTier: z.number().int().nonnegative().default(0),
  tiers: z.array(EditPlanTierSchema).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type EditPlan = z.infer<typeof EditPlanSchema>;

export const ProposedEditKindEnum = z.enum([
  "replace",
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

// Fields shared by every proposed-edit variant. The variant-specific fields
// (locator and disambiguators) live on each branch of the discriminated union.
const proposedEditBase = {
  id: ProposedEditIdSchema,
  projectId: ProjectIdSchema,
  runId: AgentRunIdSchema,
  workUnitId: WorkUnitIdSchema,
  chapterId: ChapterIdSchema,
  newContent: z.string(),
  rationale: z.string().default(""),
  status: ProposedEditStatusEnum.default("pending"),
  createdAt: timestamp,
  updatedAt: timestamp,
};

export const ProposedEditSchema = z.discriminatedUnion("kind", [
  // `replace` locates by `prefix + anchorText + suffix` — anchorText must be
  // a non-empty verbatim slice of the chapter, prefix/suffix disambiguate.
  z.object({
    ...proposedEditBase,
    kind: z.literal("replace"),
    anchorText: z.string().min(1),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
  }),
  // `insert_at` uses fromOffset and/or anchorText as the insertion locator.
  // The runtime guard in tools/proposedEdits.ts requires at least one.
  z.object({
    ...proposedEditBase,
    kind: z.literal("insert_at"),
    fromOffset: z.number().int().nonnegative().optional(),
    anchorText: z.string().optional(),
  }),
  z.object({
    ...proposedEditBase,
    kind: z.literal("append"),
  }),
  z.object({
    ...proposedEditBase,
    kind: z.literal("full_chapter"),
  }),
]);
export type ProposedEdit = z.infer<typeof ProposedEditSchema>;

export const VerificationFindingSchema = z.object({
  description: z.string().min(1),
  references: z.array(AgentReferenceSchema).default([]),
});
export type VerificationFinding = z.infer<typeof VerificationFindingSchema>;

export const VerificationSchema = z.object({
  id: VerificationIdSchema,
  projectId: ProjectIdSchema,
  runId: AgentRunIdSchema,
  tier: z.number().int().nonnegative(),
  /** Null = tier-wide drift verification. */
  workUnitId: WorkUnitIdSchema.nullable().default(null),
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

/**
 * Mode for one reader pass. Each mode has a distinct prompt, tool whitelist,
 * and termination semantics (see `runReaderLoop` and `makeReaderAgent`):
 *  - `comprehension` — forward-only, one chapter inlined per agent invocation.
 *  - `thematic`      — single whole-work invocation; hypothesize-and-confirm
 *                       motifs/symbols/subtext via search across chapters.
 *  - `self-answer`   — re-read to resolve open `question(...)` entries; the
 *                       agent proposes resolutions but does not mark them
 *                       answered (humans ratify).
 *
 * Older `readerPasses` rows written before this field existed default to
 * `"comprehension"` on Zod parse, since pass-1 was always comprehension.
 */
export const ReaderModeEnum = z.enum([
  "comprehension",
  "thematic",
  "self-answer",
]);
export type ReaderMode = z.infer<typeof ReaderModeEnum>;

export const ReaderPassSchema = z.object({
  passNumber: z.number().int().positive(),
  mode: ReaderModeEnum.default("comprehension"),
  startedAt: timestamp,
  completedAt: timestamp.nullable().default(null),
  newBibleEntries: z.number().int().nonnegative().default(0),
  newNotes: z.number().int().nonnegative().default(0),
  newQuestions: z.number().int().nonnegative().default(0),
  /**
   * Range of chapter `order` values this pass covered. Only meaningful when
   * `mode === "comprehension"` — comprehension may run as multiple segments
   * (passes), each covering a contiguous chapter range. `null` for
   * thematic / self-answer passes and for legacy rows.
   */
  firstChapterOrder: z.number().int().nonnegative().nullable().default(null),
  lastChapterOrder: z.number().int().nonnegative().nullable().default(null),
});
export type ReaderPass = z.infer<typeof ReaderPassSchema>;

export const AgentRunUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative().default(0),
  completionTokens: z.number().int().nonnegative().default(0),
  /** Cumulative tokens written into the prompt cache across this run. */
  cacheCreationTokens: z.number().int().nonnegative().default(0),
  /** Cumulative tokens served from the prompt cache across this run. */
  cacheReadTokens: z.number().int().nonnegative().default(0),
});
export type AgentRunUsage = z.infer<typeof AgentRunUsageSchema>;

export const AgentRunSchema = z.object({
  id: AgentRunIdSchema,
  projectId: ProjectIdSchema,
  name: z.string().min(1),
  status: AgentRunStatusEnum.default("idle"),
  currentTier: z.number().int().nonnegative().default(0),
  currentSnapshotManifestId: SnapshotManifestIdSchema.nullable().default(null),
  readerPasses: z.array(ReaderPassSchema).default([]),
  /**
   * Snapshot of agent model overrides at run-creation time. Historic field —
   * with the unified Agents table (v32+), per-agent model overrides live on
   * the AgentDefinition row and the runner reads them on demand. Kept for
   * backward compat with rows created before the unification; new rows leave
   * this as a partial map.
   */
  modelOverrides: z
    .record(z.string(), AgentModelOverrideSchema.nullable())
    .default({}),
  /** Hard cap; pipeline auto-pauses when totalTokenUsage exceeds this. */
  budgetTokens: z.number().int().positive().default(1_000_000),
  totalTokenUsage: AgentRunUsageSchema.default({
    promptTokens: 0,
    completionTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  }),
  /**
   * Most recent iteration's prompt_tokens. Used by the UI to surface current
   * rolling context-window pressure separately from the cumulative budget.
   */
  lastIterationPromptTokens: z.number().int().nonnegative().default(0),
  /**
   * Set true when verifier surfaces drift; UI requires an incremental Reader
   * pass before the next plan-approval gate unlocks.
   */
  requiresIncrementalReread: z.boolean().default(false),
  /** Last status-change reason — surfaced in UI banners. */
  statusReason: z.string().nullable().default(null),
  /**
   * When `status === "error"` because a phase threw, records the active
   * phase that was running so a Retry button can re-enter it. Null for
   * proactive config errors (e.g. missing API key) that aren't recoverable
   * by simply retrying, and for non-error states.
   */
  failedFromStatus: AgentRunStatusEnum.nullable().default(null),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type AgentRun = z.infer<typeof AgentRunSchema>;

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

export const SnapshotManifestSchema = z.object({
  id: SnapshotManifestIdSchema,
  projectId: ProjectIdSchema,
  runId: AgentRunIdSchema,
  tierNumber: z.number().int().nonnegative(),
  name: z.string().min(1),
  /** FKs into existing chapterSnapshots — manifests don't duplicate storage. */
  chapterSnapshotIds: z.array(ChapterSnapshotIdSchema).default([]),
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

// ─── Indexed Chunk (vector retrieval) ───────────────────────────────

export const IndexedChunkSourceTypeEnum = z.enum(["worldbuilding", "chapter"]);
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
