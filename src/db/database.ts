import Dexie, { type EntityTable } from "dexie";
import type {
  AppSettings,
  Chapter,
  Character,
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
  }
}

export const db = new WritrDatabase();
