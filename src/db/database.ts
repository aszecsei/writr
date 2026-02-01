import Dexie, { type EntityTable } from "dexie";
import type {
  AppSettings,
  Chapter,
  Character,
  CharacterRelationship,
  Location,
  Project,
  StyleGuideEntry,
  TimelineEvent,
  WorldbuildingDoc,
} from "./schemas";

export class WritrDatabase extends Dexie {
  projects!: EntityTable<Project, "id">;
  chapters!: EntityTable<Chapter, "id">;
  characters!: EntityTable<Character, "id">;
  locations!: EntityTable<Location, "id">;
  timelineEvents!: EntityTable<TimelineEvent, "id">;
  styleGuideEntries!: EntityTable<StyleGuideEntry, "id">;
  worldbuildingDocs!: EntityTable<WorldbuildingDoc, "id">;
  characterRelationships!: EntityTable<CharacterRelationship, "id">;
  appSettings!: EntityTable<AppSettings, "id">;

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
  }
}

export const db = new WritrDatabase();
