import Dexie, { type EntityTable } from "dexie";
import type {
  AppSettings,
  Chapter,
  Character,
  CharacterRelationship,
  Location,
  OutlineGridCell,
  OutlineGridColumn,
  OutlineGridRow,
  Project,
  StyleGuideEntry,
  TimelineEvent,
  WorldbuildingDoc,
  WritingSession,
  WritingSprint,
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
  outlineGridColumns!: EntityTable<OutlineGridColumn, "id">;
  outlineGridRows!: EntityTable<OutlineGridRow, "id">;
  outlineGridCells!: EntityTable<OutlineGridCell, "id">;
  writingSprints!: EntityTable<WritingSprint, "id">;
  writingSessions!: EntityTable<WritingSession, "id">;
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
  }
}

export const db = new WritrDatabase();
