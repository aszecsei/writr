import Dexie, { type EntityTable } from "dexie";
import { APP_DICTIONARY_ID, APP_SETTINGS_ID } from "@/lib/constants";
import { applyV01ToV20 } from "./migrations/v01-v20";
import { applyV21ToV40 } from "./migrations/v21-v40";
import { applyV41Plus } from "./migrations/v41-plus";
import { seedBuiltinAgents } from "./operations/agents";
import { seedBuiltinPrompts } from "./operations/savedPrompts";
import type {
  AgentDefinition,
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
  GuardrailEntry,
  IndexedChunk,
  Location,
  OutlineGridCell,
  OutlineGridColumn,
  OutlineGridRow,
  PlaylistTrack,
  Project,
  ProjectDictionary,
  SavedPrompt,
  Scene,
  StyleGuideEntry,
  TimelineEvent,
  WorldbuildingDoc,
  WritingSession,
  WritingSprint,
} from "./schemas";
import { AppDictionarySchema, AppSettingsSchema } from "./schemas";

export { backfillBinderFieldsV37 } from "./migrations/v21-v40";
export {
  backfillCoreScenesV44,
  backfillProjectCoverV46,
} from "./migrations/v41-plus";

class WritrDatabase extends Dexie {
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
  chapterSummaries!: EntityTable<ChapterSummary, "id">;
  agents!: EntityTable<AgentDefinition, "id">;
  savedPrompts!: EntityTable<SavedPrompt, "id">;
  brainstormSetups!: EntityTable<BrainstormSetup, "id">;
  brainstormIdeas!: EntityTable<BrainstormIdea, "id">;
  indexedChunks!: EntityTable<IndexedChunk, "id">;
  guardrailEntries!: EntityTable<GuardrailEntry, "id">;
  scenes!: EntityTable<Scene, "id">;

  constructor() {
    super("writr");

    applyV01ToV20(this);
    applyV21ToV40(this);
    applyV41Plus(this);

    // Seed singleton rows so liveQuery hooks never need to write
    this.on("ready", () => {
      return this.transaction(
        "rw",
        this.appSettings,
        this.appDictionary,
        this.agents,
        this.savedPrompts,
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

          await seedBuiltinAgents();
          await seedBuiltinPrompts();
        },
      );
    });
  }
}

export const db = new WritrDatabase();
