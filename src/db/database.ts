import Dexie, { type EntityTable, type Transaction } from "dexie";
import {
  BUILTIN_AGENT_DEFAULTS,
  type BuiltinAgentDefault,
} from "@/lib/ai/agents/builtins/defaults";
import { APP_DICTIONARY_ID, APP_SETTINGS_ID } from "@/lib/constants";
import type {
  AgentDefinition,
  AgentDefinitionId,
  AgentNote,
  AgentQuestion,
  AgentRun,
  AppDictionary,
  AppSettings,
  BrainstormIdea,
  BrainstormSetup,
  Chapter,
  ChapterSnapshot,
  ChapterSummary,
  Character,
  CharacterRelationship,
  Comment,
  EditPlan,
  IndexedChunk,
  Location,
  OutlineGridCell,
  OutlineGridColumn,
  OutlineGridRow,
  PlaylistTrack,
  Project,
  ProjectDictionary,
  ProposedEdit,
  ReaderBibleLogEntry,
  ReaderBibleViewEntry,
  SavedPrompt,
  SnapshotManifest,
  StyleGuideEntry,
  TimelineEvent,
  Verification,
  WorkUnit,
  WorldbuildingDoc,
  WritingSession,
  WritingSprint,
} from "./schemas";
import { AppDictionarySchema, AppSettingsSchema } from "./schemas";

/**
 * v37 migration: backfill the binder fields onto legacy chapter rows so they
 * survive Zod parse and render as top-level manuscript documents. Exported so
 * the migration can be unit-tested directly against a v36→v37 upgrade.
 */
export async function backfillBinderFieldsV37(tx: Transaction): Promise<void> {
  await tx
    .table("chapters")
    .toCollection()
    .modify((ch: Record<string, unknown>) => {
      if (ch.parentChapterId === undefined) ch.parentChapterId = null;
      if (ch.section === undefined) ch.section = "manuscript";
      if (ch.kind === undefined) ch.kind = "document";
      if (ch.includeInCompile === undefined) ch.includeInCompile = true;
      if (ch.pageBreakBefore === undefined) ch.pageBreakBefore = false;
    });
}

export class WritrDatabase extends Dexie {
  projects!: EntityTable<Project, "id">;
  chapters!: EntityTable<Chapter, "id">;
  characters!: EntityTable<Character, "id">;
  locations!: EntityTable<Location, "id">;
  timelineEvents!: EntityTable<TimelineEvent, "id">;
  styleGuideEntries!: EntityTable<StyleGuideEntry, "id">;
  worldbuildingDocs!: EntityTable<WorldbuildingDoc, "id">;
  characterRelationships!: EntityTable<CharacterRelationship, "id">;
  outlineGridColumns!: EntityTable<OutlineGridColumn, "id">;
  outlineGridRows!: EntityTable<OutlineGridRow, "id">;
  outlineGridCells!: EntityTable<OutlineGridCell, "id">;
  writingSprints!: EntityTable<WritingSprint, "id">;
  writingSessions!: EntityTable<WritingSession, "id">;
  playlistTracks!: EntityTable<PlaylistTrack, "id">;
  comments!: EntityTable<Comment, "id">;
  chapterSnapshots!: EntityTable<ChapterSnapshot, "id">;
  appSettings!: EntityTable<AppSettings, "id">;
  appDictionary!: EntityTable<AppDictionary, "id">;
  projectDictionaries!: EntityTable<ProjectDictionary, "id">;
  agentRuns!: EntityTable<AgentRun, "id">;
  readerBibleLog!: EntityTable<ReaderBibleLogEntry, "id">;
  readerBibleView!: EntityTable<ReaderBibleViewEntry, "id">;
  agentNotes!: EntityTable<AgentNote, "id">;
  agentQuestions!: EntityTable<AgentQuestion, "id">;
  workUnits!: EntityTable<WorkUnit, "id">;
  editPlans!: EntityTable<EditPlan, "id">;
  proposedEdits!: EntityTable<ProposedEdit, "id">;
  verifications!: EntityTable<Verification, "id">;
  chapterSummaries!: EntityTable<ChapterSummary, "id">;
  snapshotManifests!: EntityTable<SnapshotManifest, "id">;
  agents!: EntityTable<AgentDefinition, "id">;
  savedPrompts!: EntityTable<SavedPrompt, "id">;
  brainstormSetups!: EntityTable<BrainstormSetup, "id">;
  brainstormIdeas!: EntityTable<BrainstormIdea, "id">;
  indexedChunks!: EntityTable<IndexedChunk, "id">;

  constructor() {
    super("writr");

    this.version(1).stores({
      projects: "id, title, updatedAt",
      chapters: "id, projectId, [projectId+order], updatedAt",
      characters: "id, projectId, name, role",
      locations: "id, projectId, name, parentLocationId",
      timelineEvents: "id, projectId, [projectId+order]",
      styleGuideEntries: "id, projectId, [projectId+order], category",
      worldbuildingDocs: "id, projectId, *tags",
      appSettings: "id",
    });

    this.version(2).stores({
      projects: "id, title, updatedAt",
      chapters: "id, projectId, [projectId+order], updatedAt",
      characters: "id, projectId, name, role",
      locations: "id, projectId, name, parentLocationId",
      timelineEvents: "id, projectId, [projectId+order]",
      styleGuideEntries: "id, projectId, [projectId+order], category",
      worldbuildingDocs: "id, projectId, *tags",
      characterRelationships:
        "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
      appSettings: "id",
    });

    this.version(3)
      .stores({
        projects: "id, title, updatedAt",
        chapters: "id, projectId, [projectId+order], updatedAt",
        characters: "id, projectId, name, role",
        locations: "id, projectId, name, parentLocationId",
        timelineEvents: "id, projectId, [projectId+order]",
        styleGuideEntries: "id, projectId, [projectId+order], category",
        worldbuildingDocs:
          "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
        characterRelationships:
          "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
        appSettings: "id",
      })
      .upgrade((tx) =>
        tx
          .table("worldbuildingDocs")
          .toCollection()
          .modify((doc) => {
            if (doc.parentDocId === undefined) doc.parentDocId = null;
            if (doc.order === undefined) doc.order = 0;
          }),
      );

    this.version(4).upgrade((tx) =>
      tx
        .table("characters")
        .toCollection()
        .modify((c) => {
          if (c.pronouns === undefined) c.pronouns = "";
          if (c.personality === undefined) c.personality = "";
          if (c.motivations === undefined) c.motivations = "";
          if (c.internalConflict === undefined) c.internalConflict = "";
          if (c.strengths === undefined) c.strengths = "";
          if (c.weaknesses === undefined) c.weaknesses = "";
          if (c.characterArcs === undefined) c.characterArcs = "";
          if (c.dialogueStyle === undefined) c.dialogueStyle = "";
        }),
    );

    this.version(5).upgrade((tx) =>
      tx
        .table("characters")
        .toCollection()
        .modify((c) => {
          if (c.backstory === undefined) c.backstory = "";
          if (c.notes === undefined) c.notes = "";
        }),
    );

    this.version(6).stores({
      projects: "id, title, updatedAt",
      chapters: "id, projectId, [projectId+order], updatedAt",
      characters: "id, projectId, name, role",
      locations: "id, projectId, name, parentLocationId",
      timelineEvents: "id, projectId, [projectId+order]",
      styleGuideEntries: "id, projectId, [projectId+order], category",
      worldbuildingDocs:
        "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
      characterRelationships:
        "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
      outlineColumns: "id, projectId, [projectId+order]",
      outlineCards: "id, projectId, columnId, [columnId+order]",
      appSettings: "id",
    });

    this.version(7).stores({
      projects: "id, title, updatedAt",
      chapters: "id, projectId, [projectId+order], updatedAt",
      characters: "id, projectId, name, role",
      locations: "id, projectId, name, parentLocationId",
      timelineEvents: "id, projectId, [projectId+order]",
      styleGuideEntries: "id, projectId, [projectId+order], category",
      worldbuildingDocs:
        "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
      characterRelationships:
        "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
      outlineColumns: "id, projectId, [projectId+order]",
      outlineCards: "id, projectId, columnId, [columnId+order]",
      writingSprints:
        "id, projectId, chapterId, status, startedAt, [projectId+startedAt]",
      appSettings: "id",
    });

    this.version(8).stores({
      projects: "id, title, updatedAt",
      chapters: "id, projectId, [projectId+order], updatedAt",
      characters: "id, projectId, name, role",
      locations: "id, projectId, name, parentLocationId",
      timelineEvents: "id, projectId, [projectId+order]",
      styleGuideEntries: "id, projectId, [projectId+order], category",
      worldbuildingDocs:
        "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
      characterRelationships:
        "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
      outlineColumns: "id, projectId, [projectId+order]",
      outlineCards: "id, projectId, columnId, [columnId+order]",
      writingSprints:
        "id, projectId, chapterId, status, startedAt, [projectId+startedAt]",
      writingSessions:
        "id, projectId, chapterId, date, [projectId+date], [date+hourOfDay]",
      appSettings: "id",
    });

    this.version(9).stores({
      projects: "id, title, updatedAt",
      chapters: "id, projectId, [projectId+order], updatedAt",
      characters: "id, projectId, name, role",
      locations: "id, projectId, name, parentLocationId",
      timelineEvents: "id, projectId, [projectId+order]",
      styleGuideEntries: "id, projectId, [projectId+order], category",
      worldbuildingDocs:
        "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
      characterRelationships:
        "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
      outlineColumns: "id, projectId, [projectId+order]",
      outlineCards: "id, projectId, columnId, [columnId+order]",
      outlineGridColumns: "id, projectId, [projectId+order]",
      outlineGridRows: "id, projectId, linkedChapterId, [projectId+order]",
      outlineGridCells: "id, projectId, rowId, columnId, [rowId+columnId]",
      writingSprints:
        "id, projectId, chapterId, status, startedAt, [projectId+startedAt]",
      writingSessions:
        "id, projectId, chapterId, date, [projectId+date], [date+hourOfDay]",
      appSettings: "id",
    });

    this.version(10).stores({
      projects: "id, title, updatedAt",
      chapters: "id, projectId, [projectId+order], updatedAt",
      characters: "id, projectId, name, role",
      locations: "id, projectId, name, parentLocationId",
      timelineEvents: "id, projectId, [projectId+order]",
      styleGuideEntries: "id, projectId, [projectId+order], category",
      worldbuildingDocs:
        "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
      characterRelationships:
        "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
      outlineColumns: "id, projectId, [projectId+order]",
      outlineCards: "id, projectId, columnId, [columnId+order]",
      outlineGridColumns: "id, projectId, [projectId+order]",
      outlineGridRows: "id, projectId, linkedChapterId, [projectId+order]",
      outlineGridCells: "id, projectId, rowId, columnId, [rowId+columnId]",
      writingSprints:
        "id, projectId, chapterId, status, startedAt, [projectId+startedAt]",
      writingSessions:
        "id, projectId, chapterId, date, [projectId+date], [date+hourOfDay]",
      playlistTracks: "id, projectId, [projectId+order]",
      appSettings: "id",
    });

    this.version(11).stores({
      projects: "id, title, updatedAt",
      chapters: "id, projectId, [projectId+order], updatedAt",
      characters: "id, projectId, name, role",
      locations: "id, projectId, name, parentLocationId",
      timelineEvents: "id, projectId, [projectId+order]",
      styleGuideEntries: "id, projectId, [projectId+order], category",
      worldbuildingDocs:
        "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
      characterRelationships:
        "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
      outlineColumns: "id, projectId, [projectId+order]",
      outlineCards: "id, projectId, columnId, [columnId+order]",
      outlineGridColumns: "id, projectId, [projectId+order]",
      outlineGridRows: "id, projectId, linkedChapterId, [projectId+order]",
      outlineGridCells: "id, projectId, rowId, columnId, [rowId+columnId]",
      writingSprints:
        "id, projectId, chapterId, status, startedAt, [projectId+startedAt]",
      writingSessions:
        "id, projectId, chapterId, date, [projectId+date], [date+hourOfDay]",
      playlistTracks: "id, projectId, [projectId+order]",
      comments: "id, projectId, chapterId, [chapterId+fromOffset], status",
      appSettings: "id",
    });

    this.version(12).stores({
      projects: "id, title, updatedAt",
      chapters: "id, projectId, [projectId+order], updatedAt",
      characters: "id, projectId, name, role",
      locations: "id, projectId, name, parentLocationId",
      timelineEvents: "id, projectId, [projectId+order]",
      styleGuideEntries: "id, projectId, [projectId+order], category",
      worldbuildingDocs:
        "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
      characterRelationships:
        "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
      outlineColumns: "id, projectId, [projectId+order]",
      outlineCards: "id, projectId, columnId, [columnId+order]",
      outlineGridColumns: "id, projectId, [projectId+order]",
      outlineGridRows: "id, projectId, linkedChapterId, [projectId+order]",
      outlineGridCells: "id, projectId, rowId, columnId, [rowId+columnId]",
      writingSprints:
        "id, projectId, chapterId, status, startedAt, [projectId+startedAt]",
      writingSessions:
        "id, projectId, chapterId, date, [projectId+date], [date+hourOfDay]",
      playlistTracks: "id, projectId, [projectId+order]",
      comments: "id, projectId, chapterId, [chapterId+fromOffset], status",
      appSettings: "id",
      appDictionary: "id",
      projectDictionaries: "id, projectId",
    });

    this.version(13).upgrade((tx) =>
      tx
        .table("appSettings")
        .toCollection()
        .modify((s) => {
          if (s.lastExportedAt === undefined) s.lastExportedAt = null;
        }),
    );

    this.version(14).stores({
      projects: "id, title, updatedAt",
      chapters: "id, projectId, [projectId+order], updatedAt",
      characters: "id, projectId, name, role",
      locations: "id, projectId, name, parentLocationId",
      timelineEvents: "id, projectId, [projectId+order]",
      styleGuideEntries: "id, projectId, [projectId+order], category",
      worldbuildingDocs:
        "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
      characterRelationships:
        "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
      outlineColumns: "id, projectId, [projectId+order]",
      outlineCards: "id, projectId, columnId, [columnId+order]",
      outlineGridColumns: "id, projectId, [projectId+order]",
      outlineGridRows: "id, projectId, linkedChapterId, [projectId+order]",
      outlineGridCells: "id, projectId, rowId, columnId, [rowId+columnId]",
      writingSprints:
        "id, projectId, chapterId, status, startedAt, [projectId+startedAt]",
      writingSessions:
        "id, projectId, chapterId, date, [projectId+date], [date+hourOfDay]",
      playlistTracks: "id, projectId, [projectId+order]",
      comments: "id, projectId, chapterId, [chapterId+fromOffset], status",
      chapterSnapshots: "id, chapterId, projectId, [chapterId+createdAt]",
      appSettings: "id",
      appDictionary: "id",
      projectDictionaries: "id, projectId",
    });

    this.version(15).upgrade((tx) =>
      tx
        .table("appSettings")
        .toCollection()
        .modify((s) => {
          if (s.primaryColor === undefined) s.primaryColor = "blue";
          if (s.neutralColor === undefined) s.neutralColor = "zinc";
          if (s.editorWidth === undefined) s.editorWidth = "medium";
          if (s.uiDensity === undefined) s.uiDensity = "comfortable";
        }),
    );

    this.version(16).upgrade((tx) =>
      tx
        .table("appSettings")
        .toCollection()
        .modify((s) => {
          if (s.aiProvider === undefined) s.aiProvider = "openrouter";
          if (s.anthropicApiKey === undefined) s.anthropicApiKey = "";
          if (s.openAiApiKey === undefined) s.openAiApiKey = "";
          if (s.grokApiKey === undefined) s.grokApiKey = "";
          if (s.zaiApiKey === undefined) s.zaiApiKey = "";
        }),
    );

    this.version(17).upgrade((tx) =>
      tx
        .table("appSettings")
        .toCollection()
        .modify((s) => {
          if (s.providerApiKeys === undefined) {
            s.providerApiKeys = {
              openrouter: s.openRouterApiKey ?? "",
              anthropic: s.anthropicApiKey ?? "",
              openai: s.openAiApiKey ?? "",
              grok: s.grokApiKey ?? "",
              zai: s.zaiApiKey ?? "",
            };
          }
          if (s.providerModels === undefined) {
            s.providerModels = {
              openrouter: s.preferredModel ?? "openai/gpt-4o",
              anthropic: "claude-sonnet-4-5-20250929",
              openai: "gpt-4o",
              grok: "grok-3",
              zai: "glm-4.7",
            };
          }
          delete s.openRouterApiKey;
          delete s.anthropicApiKey;
          delete s.openAiApiKey;
          delete s.grokApiKey;
          delete s.zaiApiKey;
          delete s.preferredModel;
        }),
    );

    this.version(18).upgrade((tx) =>
      tx
        .table("appSettings")
        .toCollection()
        .modify((s) => {
          if (s.assistantPrefill === undefined) s.assistantPrefill = "";
        }),
    );

    this.version(19).upgrade((tx) =>
      tx
        .table("appSettings")
        .toCollection()
        .modify((s) => {
          if (s.customSystemPrompt === undefined) s.customSystemPrompt = null;
          if (s.disabledBuiltinTools === undefined) s.disabledBuiltinTools = [];
          if (s.builtinToolOverrides === undefined) s.builtinToolOverrides = {};
          if (s.customTools === undefined) s.customTools = [];
        }),
    );

    this.version(20).upgrade(async (tx) => {
      await tx
        .table("characters")
        .toCollection()
        .modify((c) => {
          if (c.images === undefined) c.images = [];
        });
      await tx
        .table("locations")
        .toCollection()
        .modify((l) => {
          if (l.images === undefined) l.images = [];
        });
    });

    this.version(21).upgrade((tx) =>
      tx
        .table("appSettings")
        .toCollection()
        .modify((s) => {
          if (s.providerApiKeys && !("google" in s.providerApiKeys)) {
            s.providerApiKeys.google = "";
            s.providerApiKeys.vertex = "";
          }
          if (s.providerModels && !("google" in s.providerModels)) {
            s.providerModels.google = "gemini-2.5-flash";
            s.providerModels.vertex = "gemini-2.5-flash";
          }
        }),
    );

    this.version(22).upgrade((tx) =>
      tx
        .table("appSettings")
        .toCollection()
        .modify((s) => {
          if (s.goalCountdownDisplay === undefined) {
            s.goalCountdownDisplay = "estimated-date";
          }
        }),
    );

    this.version(23).upgrade((tx) =>
      tx
        .table("projects")
        .toCollection()
        .modify((p) => {
          if (p.mode === undefined) p.mode = "prose";
        }),
    );

    this.version(24).upgrade((tx) =>
      tx
        .table("appSettings")
        .toCollection()
        .modify((s) => {
          if (s.enableToolCalling === undefined) {
            s.enableToolCalling = false;
          }
        }),
    );

    this.version(25).upgrade((tx) =>
      tx
        .table("appSettings")
        .toCollection()
        .modify((s) => {
          if (s.agentModelOverrides === undefined) {
            s.agentModelOverrides = {
              reader: null,
              orchestrator: null,
              editor: null,
              verifier: null,
            };
          }
        }),
    );

    // v26: tables for the manuscript review/edit pipeline. All eleven tables
    // declared together (some only used in Phase 2/3) so we don't ship five
    // separate disturbance migrations as features land.
    this.version(26).stores({
      projects: "id, title, updatedAt",
      chapters: "id, projectId, [projectId+order], updatedAt",
      characters: "id, projectId, name, role",
      locations: "id, projectId, name, parentLocationId",
      timelineEvents: "id, projectId, [projectId+order]",
      styleGuideEntries: "id, projectId, [projectId+order], category",
      worldbuildingDocs:
        "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
      characterRelationships:
        "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
      outlineColumns: "id, projectId, [projectId+order]",
      outlineCards: "id, projectId, columnId, [columnId+order]",
      outlineGridColumns: "id, projectId, [projectId+order]",
      outlineGridRows: "id, projectId, linkedChapterId, [projectId+order]",
      outlineGridCells: "id, projectId, rowId, columnId, [rowId+columnId]",
      writingSprints:
        "id, projectId, chapterId, status, startedAt, [projectId+startedAt]",
      writingSessions:
        "id, projectId, chapterId, date, [projectId+date], [date+hourOfDay]",
      playlistTracks: "id, projectId, [projectId+order]",
      comments: "id, projectId, chapterId, [chapterId+fromOffset], status",
      chapterSnapshots: "id, chapterId, projectId, [chapterId+createdAt]",
      appSettings: "id",
      appDictionary: "id",
      projectDictionaries: "id, projectId",
      agentRuns: "id, projectId, status, [projectId+createdAt]",
      readerBibleLog:
        "id, projectId, runId, [projectId+path], [runId+createdAt]",
      readerBibleView: "id, [projectId+path], projectId",
      agentNotes: "id, projectId, runId, chapterId, [runId+status]",
      agentQuestions: "id, projectId, runId, [runId+status]",
      workUnits: "id, projectId, runId, [runId+tier], [runId+status]",
      editPlans: "id, projectId, runId",
      proposedEdits:
        "id, projectId, runId, workUnitId, chapterId, [workUnitId+status]",
      verifications: "id, projectId, runId, [runId+tier]",
      chapterSummaries:
        "id, projectId, chapterId, [chapterId+sourceContentHash]",
      snapshotManifests: "id, projectId, runId, [runId+tierNumber]",
    });

    // v27 (legacy): user-defined "custom agents" — this table was renamed to
    // `agents` in v32 with seeded built-in rows for spark/scene/reader/editor/
    // character-dialogue/brainstorm/chat/orchestrator/verifier.
    this.version(27).stores({
      projects: "id, title, updatedAt",
      chapters: "id, projectId, [projectId+order], updatedAt",
      characters: "id, projectId, name, role",
      locations: "id, projectId, name, parentLocationId",
      timelineEvents: "id, projectId, [projectId+order]",
      styleGuideEntries: "id, projectId, [projectId+order], category",
      worldbuildingDocs:
        "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
      characterRelationships:
        "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
      outlineColumns: "id, projectId, [projectId+order]",
      outlineCards: "id, projectId, columnId, [columnId+order]",
      outlineGridColumns: "id, projectId, [projectId+order]",
      outlineGridRows: "id, projectId, linkedChapterId, [projectId+order]",
      outlineGridCells: "id, projectId, rowId, columnId, [rowId+columnId]",
      writingSprints:
        "id, projectId, chapterId, status, startedAt, [projectId+startedAt]",
      writingSessions:
        "id, projectId, chapterId, date, [projectId+date], [date+hourOfDay]",
      playlistTracks: "id, projectId, [projectId+order]",
      comments: "id, projectId, chapterId, [chapterId+fromOffset], status",
      chapterSnapshots: "id, chapterId, projectId, [chapterId+createdAt]",
      appSettings: "id",
      appDictionary: "id",
      projectDictionaries: "id, projectId",
      agentRuns: "id, projectId, status, [projectId+createdAt]",
      readerBibleLog:
        "id, projectId, runId, [projectId+path], [runId+createdAt]",
      readerBibleView: "id, [projectId+path], projectId",
      agentNotes: "id, projectId, runId, chapterId, [runId+status]",
      agentQuestions: "id, projectId, runId, [runId+status]",
      workUnits: "id, projectId, runId, [runId+tier], [runId+status]",
      editPlans: "id, projectId, runId",
      proposedEdits:
        "id, projectId, runId, workUnitId, chapterId, [workUnitId+status]",
      verifications: "id, projectId, runId, [runId+tier]",
      chapterSummaries:
        "id, projectId, chapterId, [chapterId+sourceContentHash]",
      snapshotManifests: "id, projectId, runId, [runId+tierNumber]",
      customAgents: "id, projectId, [projectId+name], updatedAt",
    });

    // v28: backfill `lastIterationPromptTokens` on agent runs so existing
    // rows satisfy the new non-optional schema field.
    this.version(28).upgrade((tx) =>
      tx
        .table("agentRuns")
        .toCollection()
        .modify((r) => {
          if (r.lastIterationPromptTokens === undefined) {
            r.lastIterationPromptTokens = 0;
          }
        }),
    );

    // v29: scope reader bible view per-run. The view used to be keyed on
    // (projectId, path), which caused multiple runs in the same project to
    // share — and clobber — bible state. Now keyed on (runId, path). Existing
    // rows are wiped and rebuilt by replaying the log per run.
    this.version(29)
      .stores({
        projects: "id, title, updatedAt",
        chapters: "id, projectId, [projectId+order], updatedAt",
        characters: "id, projectId, name, role",
        locations: "id, projectId, name, parentLocationId",
        timelineEvents: "id, projectId, [projectId+order]",
        styleGuideEntries: "id, projectId, [projectId+order], category",
        worldbuildingDocs:
          "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
        characterRelationships:
          "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
        outlineColumns: "id, projectId, [projectId+order]",
        outlineCards: "id, projectId, columnId, [columnId+order]",
        outlineGridColumns: "id, projectId, [projectId+order]",
        outlineGridRows: "id, projectId, linkedChapterId, [projectId+order]",
        outlineGridCells: "id, projectId, rowId, columnId, [rowId+columnId]",
        writingSprints:
          "id, projectId, chapterId, status, startedAt, [projectId+startedAt]",
        writingSessions:
          "id, projectId, chapterId, date, [projectId+date], [date+hourOfDay]",
        playlistTracks: "id, projectId, [projectId+order]",
        comments: "id, projectId, chapterId, [chapterId+fromOffset], status",
        chapterSnapshots: "id, chapterId, projectId, [chapterId+createdAt]",
        appSettings: "id",
        appDictionary: "id",
        projectDictionaries: "id, projectId",
        agentRuns: "id, projectId, status, [projectId+createdAt]",
        readerBibleLog:
          "id, projectId, runId, [projectId+path], [runId+createdAt]",
        readerBibleView: "id, projectId, runId, [runId+path]",
        agentNotes: "id, projectId, runId, chapterId, [runId+status]",
        agentQuestions: "id, projectId, runId, [runId+status]",
        workUnits: "id, projectId, runId, [runId+tier], [runId+status]",
        editPlans: "id, projectId, runId",
        proposedEdits:
          "id, projectId, runId, workUnitId, chapterId, [workUnitId+status]",
        verifications: "id, projectId, runId, [runId+tier]",
        chapterSummaries:
          "id, projectId, chapterId, [chapterId+sourceContentHash]",
        snapshotManifests: "id, projectId, runId, [runId+tierNumber]",
        customAgents: "id, projectId, [projectId+name], updatedAt",
      })
      .upgrade(async (tx) => {
        const view = tx.table("readerBibleView");
        const log = tx.table("readerBibleLog");

        await view.clear();

        const allLog = await log.toArray();
        // Group log entries by runId, preserving chronological order so the
        // replay applies merge/set/delete in the correct sequence.
        allLog.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        const viewByKey = new Map<
          string,
          {
            id: string;
            projectId: string;
            runId: string;
            path: string;
            value: unknown;
            lastUpdatedAt: string;
            lastLogEntryId: string;
          }
        >();

        const isPlainObject = (v: unknown): v is Record<string, unknown> =>
          v !== null && typeof v === "object" && !Array.isArray(v);
        const deepMerge = (prev: unknown, next: unknown): unknown => {
          if (isPlainObject(prev) && isPlainObject(next)) {
            const out: Record<string, unknown> = { ...prev };
            for (const [k, v] of Object.entries(next)) {
              out[k] =
                k in out && isPlainObject(out[k]) && isPlainObject(v)
                  ? deepMerge(out[k], v)
                  : v;
            }
            return out;
          }
          return next;
        };

        for (const entry of allLog as Array<{
          id: string;
          projectId: string;
          runId: string;
          path: string;
          op: "set" | "merge" | "delete";
          value: unknown;
          createdAt: string;
        }>) {
          const key = `${entry.runId}::${entry.path}`;
          if (entry.op === "delete") {
            viewByKey.delete(key);
            continue;
          }
          const existing = viewByKey.get(key);
          const nextValue =
            entry.op === "merge" && existing
              ? deepMerge(existing.value, entry.value)
              : entry.value;
          viewByKey.set(key, {
            id: existing?.id ?? crypto.randomUUID(),
            projectId: entry.projectId,
            runId: entry.runId,
            path: entry.path,
            value: nextValue,
            lastUpdatedAt: entry.createdAt,
            lastLogEntryId: entry.id,
          });
        }

        if (viewByKey.size > 0) {
          await view.bulkAdd(Array.from(viewByKey.values()));
        }
      });

    // v30: backfill `comprehensionContextThreshold` on the singleton
    // settings row so existing installs satisfy the new non-optional field.
    this.version(30).upgrade((tx) =>
      tx
        .table("appSettings")
        .toCollection()
        .modify((s) => {
          if (s.comprehensionContextThreshold === undefined) {
            s.comprehensionContextThreshold = 80_000;
          }
        }),
    );

    // v31: backfill `cacheCreationTokens` / `cacheReadTokens` on existing
    // agent runs so they satisfy the new non-optional schema fields.
    this.version(31).upgrade((tx) =>
      tx
        .table("agentRuns")
        .toCollection()
        .modify((r) => {
          if (r.totalTokenUsage) {
            if (r.totalTokenUsage.cacheCreationTokens === undefined) {
              r.totalTokenUsage.cacheCreationTokens = 0;
            }
            if (r.totalTokenUsage.cacheReadTokens === undefined) {
              r.totalTokenUsage.cacheReadTokens = 0;
            }
          }
        }),
    );

    // v32: collapse the AI Assistant tools, Custom Tools, and Pipeline Agents
    // settings into a single unified `agents` table. The previous
    // `customAgents` table is renamed (its rows become kind="user"). Built-in
    // agent rows are seeded for spark / scene / reader / editor /
    // character-dialogue / brainstorm / chat / orchestrator / verifier with
    // any matching settings.agentModelOverrides[kind] copied to the row's
    // modelOverride field. Old AppSettings fields (customTools,
    // agentModelOverrides, disabledBuiltinTools, builtinToolOverrides) are
    // dropped — customTools rows migrate to kind="user" agent rows, and
    // builtinToolOverrides become per-agent systemPrompt overrides.
    this.version(32)
      .stores({
        projects: "id, title, updatedAt",
        chapters: "id, projectId, [projectId+order], updatedAt",
        characters: "id, projectId, name, role",
        locations: "id, projectId, name, parentLocationId",
        timelineEvents: "id, projectId, [projectId+order]",
        styleGuideEntries: "id, projectId, [projectId+order], category",
        worldbuildingDocs:
          "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
        characterRelationships:
          "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
        outlineColumns: "id, projectId, [projectId+order]",
        outlineCards: "id, projectId, columnId, [columnId+order]",
        outlineGridColumns: "id, projectId, [projectId+order]",
        outlineGridRows: "id, projectId, linkedChapterId, [projectId+order]",
        outlineGridCells: "id, projectId, rowId, columnId, [rowId+columnId]",
        writingSprints:
          "id, projectId, chapterId, status, startedAt, [projectId+startedAt]",
        writingSessions:
          "id, projectId, chapterId, date, [projectId+date], [date+hourOfDay]",
        playlistTracks: "id, projectId, [projectId+order]",
        comments: "id, projectId, chapterId, [chapterId+fromOffset], status",
        chapterSnapshots: "id, chapterId, projectId, [chapterId+createdAt]",
        appSettings: "id",
        appDictionary: "id",
        projectDictionaries: "id, projectId",
        agentRuns: "id, projectId, status, [projectId+createdAt]",
        readerBibleLog:
          "id, projectId, runId, [projectId+path], [runId+createdAt]",
        readerBibleView: "id, projectId, runId, [runId+path]",
        agentNotes: "id, projectId, runId, chapterId, [runId+status]",
        agentQuestions: "id, projectId, runId, [runId+status]",
        workUnits: "id, projectId, runId, [runId+tier], [runId+status]",
        editPlans: "id, projectId, runId",
        proposedEdits:
          "id, projectId, runId, workUnitId, chapterId, [workUnitId+status]",
        verifications: "id, projectId, runId, [runId+tier]",
        chapterSummaries:
          "id, projectId, chapterId, [chapterId+sourceContentHash]",
        snapshotManifests: "id, projectId, runId, [runId+tierNumber]",
        // New unified agents table. Drops the old `customAgents` table.
        agents: "id, kind, projectId, [kind+projectId], updatedAt",
        customAgents: null,
      })
      .upgrade(async (tx) => {
        const timestamp = new Date().toISOString();

        // 1. Migrate existing customAgents rows → agents (kind="user").
        const oldCustomAgents = await tx
          .table("customAgents")
          .toArray()
          .catch(() => [] as Record<string, unknown>[]);
        const agents = tx.table("agents");
        for (const row of oldCustomAgents) {
          await agents.add({
            ...row,
            kind: "user",
          });
        }

        // 2. Read old AppSettings to migrate agentModelOverrides + customTools.
        const settingsRow = await tx
          .table("appSettings")
          .get(APP_SETTINGS_ID)
          .catch(() => undefined);
        const oldOverrides: Record<
          string,
          { provider: string; model: string; reasoningEffort?: string } | null
        > = settingsRow?.agentModelOverrides ?? {};
        const oldCustomTools: Array<{
          id: string;
          name: string;
          prompt: string;
        }> = settingsRow?.customTools ?? [];
        const oldBuiltinOverrides: Record<string, string> =
          settingsRow?.builtinToolOverrides ?? {};

        // 3. Seed built-in agents. Each row is created with the bundled
        //    default; if the user previously set a model override or tool-
        //    prompt override for the corresponding kind, copy it into the row.
        //
        //    `legacyToolOverrideId` maps the new agent kind to the old
        //    `builtinToolOverrides` key so a user-customized prompt carries
        //    over: e.g. an override for "review-text" lands on the new Reader
        //    agent. Sparks/scenes both inherit from the old generate-prose
        //    override (lossy on purpose — there's nothing more specific).
        const legacyOverrideMap: Partial<Record<string, string>> = {
          spark: "generate-prose",
          scene: "generate-prose",
          reader: "review-text",
          editor: "suggest-edits",
          "character-dialogue": "character-dialogue",
          brainstorm: "brainstorm",
        };

        const builtinKinds = [
          "spark",
          "scene",
          "reader",
          "editor",
          "character-dialogue",
          "brainstorm",
          "chat",
          "orchestrator",
          "verifier",
        ] as const;

        for (const kind of builtinKinds) {
          const def: BuiltinAgentDefault = BUILTIN_AGENT_DEFAULTS[kind];
          const modelOverride = oldOverrides[kind] ?? null;
          const legacyId = legacyOverrideMap[kind];
          const promptOverride = legacyId
            ? oldBuiltinOverrides[legacyId]
            : undefined;
          await agents.add({
            id: crypto.randomUUID(),
            kind,
            projectId: null,
            name: def.name,
            description: def.description,
            systemPrompt:
              promptOverride && promptOverride.length > 0
                ? promptOverride
                : def.systemPrompt,
            allowedToolIds: def.allowedToolIds,
            modelOverride,
            assistantPrefill: def.assistantPrefill ?? "",
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }

        // 4. Migrate customTools → user agents.
        for (const tool of oldCustomTools) {
          if (!tool.name?.trim() || !tool.prompt?.trim()) continue;
          await agents.add({
            id: tool.id || crypto.randomUUID(),
            kind: "user",
            projectId: null,
            name: tool.name.trim(),
            description: "",
            systemPrompt: tool.prompt.trim(),
            allowedToolIds: [],
            modelOverride: null,
            assistantPrefill: "",
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }

        // 5. Strip deprecated AppSettings fields.
        await tx
          .table("appSettings")
          .toCollection()
          .modify((s: Record<string, unknown>) => {
            delete s.agentModelOverrides;
            delete s.disabledBuiltinTools;
            delete s.builtinToolOverrides;
            delete s.customTools;
          });
      });

    // v33: rewrite agent allowedToolIds to use the consolidated `list` /
    // `get` tools (with per-category scoping like `list:chapter`,
    // `get:summary`). The 14 obsolete per-entity read tools were removed in
    // the same change; this migration upgrades both seeded built-in rows
    // (covers installs that ran v32 before the rewrite) and user-created
    // agents that opted into any of those tool ids.
    this.version(33).upgrade(async (tx) => {
      const idMap: Record<string, string> = {
        list_characters: "list:character",
        list_locations: "list:location",
        list_timeline_events: "list:timeline",
        list_chapters: "list:chapter",
        list_style_guide: "list:style_guide",
        list_worldbuilding_docs: "list:worldbuilding",
        get_character: "get:character",
        get_location: "get:location",
        get_timeline_event: "get:timeline",
        get_chapter: "get:chapter",
        get_style_guide_entry: "get:style_guide",
        get_worldbuilding_doc: "get:worldbuilding",
        get_outline: "get:outline",
        read_summary: "get:summary",
      };
      await tx
        .table("agents")
        .toCollection()
        .modify((a: { allowedToolIds?: string[] }) => {
          if (!Array.isArray(a.allowedToolIds)) return;
          const seen = new Set<string>();
          const next: string[] = [];
          for (const id of a.allowedToolIds) {
            const mapped = idMap[id] ?? id;
            if (seen.has(mapped)) continue;
            seen.add(mapped);
            next.push(mapped);
          }
          a.allowedToolIds = next;
        });
    });

    // v34: backfill `failedFromStatus` on existing agentRuns rows so legacy
    // rows survive Zod parse after the field was added.
    this.version(34).upgrade((tx) =>
      tx
        .table("agentRuns")
        .toCollection()
        .modify((r: { failedFromStatus?: unknown }) => {
          if (r.failedFromStatus === undefined) r.failedFromStatus = null;
        }),
    );

    // v35: add `parentCommentId` to the comments store for threaded replies.
    // No upgrade function — missing fields default to undefined in Dexie and
    // the Zod schema's `.default(null)` normalizes them on read. New index on
    // parentCommentId so replies can be fetched per-root in one query.
    this.version(35).stores({
      comments:
        "id, projectId, chapterId, [chapterId+fromOffset], status, parentCommentId",
    });

    // v36: add savedPrompts table for the reusable prompt library. projectId
    // is nullable (null = global), so it is indexed for scope lookups.
    this.version(36).stores({
      savedPrompts: "id, projectId, [projectId+updatedAt]",
    });

    // v37: binder hierarchy. Adds parentChapterId / section / kind /
    // includeInCompile / pageBreakBefore to chapters. No index change — nesting
    // is queried by JS-side filter (mirrors worldbuildingDocs). Backfill keeps
    // legacy chapters as top-level manuscript documents.
    this.version(37).upgrade(backfillBinderFieldsV37);

    // v38: brainstorm feature — global, not project-scoped. Two tables: named
    // setups (columns + madlibs pattern) and saved rolled entries. UUID ids;
    // no singleton seeding. setupId on ideas is indexed for per-setup lookups.
    this.version(38).stores({
      brainstormSetups: "id, updatedAt",
      brainstormIdeas: "id, setupId, createdAt",
    });

    // v39: indexedChunks table backing semantic lore/scene retrieval. Vectors
    // are stored as plain number[]; cosine search is brute-force in a worker.
    this.version(39).stores({
      indexedChunks:
        "id, projectId, [projectId+sourceType], sourceId, [sourceId+chunkIndex]",
    });

    // Seed singleton rows so liveQuery hooks never need to write
    this.on("ready", () => {
      return this.transaction(
        "rw",
        this.appSettings,
        this.appDictionary,
        this.agents,
        async () => {
          const timestamp = new Date().toISOString();
          const settings = await this.appSettings.get(APP_SETTINGS_ID);
          if (!settings) {
            await this.appSettings.add(
              AppSettingsSchema.parse({
                id: APP_SETTINGS_ID,
                updatedAt: timestamp,
              }),
            );
          }
          const dict = await this.appDictionary.get(APP_DICTIONARY_ID);
          if (!dict) {
            await this.appDictionary.add(
              AppDictionarySchema.parse({
                id: APP_DICTIONARY_ID,
                words: [],
                updatedAt: timestamp,
              }),
            );
          }

          // Idempotent built-in agent seed. Covers fresh installs (where the
          // v32 migration didn't run because there was nothing to migrate)
          // and any case where a built-in row went missing.
          const existingAgents = await this.agents.toArray();
          const presentKinds = new Set(
            existingAgents.filter((a) => a.kind !== "user").map((a) => a.kind),
          );
          const builtinKinds = Object.keys(
            BUILTIN_AGENT_DEFAULTS,
          ) as (keyof typeof BUILTIN_AGENT_DEFAULTS)[];
          for (const kind of builtinKinds) {
            if (presentKinds.has(kind)) continue;
            const def = BUILTIN_AGENT_DEFAULTS[kind];
            await this.agents.add({
              id: crypto.randomUUID() as AgentDefinitionId,
              kind,
              projectId: null,
              name: def.name,
              description: def.description,
              systemPrompt: def.systemPrompt,
              allowedToolIds: def.allowedToolIds,
              modelOverride: null,
              assistantPrefill: def.assistantPrefill ?? "",
              createdAt: timestamp,
              updatedAt: timestamp,
            });
          }
        },
      );
    });
  }
}

export const db = new WritrDatabase();
