import type {
  Chapter,
  ChapterId,
  Character,
  CharacterId,
  CharacterRelationship,
  CharacterRelationshipId,
  Location,
  LocationId,
  OutlineGridCell,
  OutlineGridCellId,
  OutlineGridColumn,
  OutlineGridColumnId,
  OutlineGridRow,
  OutlineGridRowId,
  Project,
  ProjectId,
  StyleGuideEntry,
  StyleGuideEntryId,
  TimelineEvent,
  TimelineEventId,
  WorldbuildingDoc,
  WorldbuildingDocId,
} from "@/db/schemas";

const ts = "2024-01-01T00:00:00.000Z";
let counter = 0;

function nextRawId(): string {
  counter++;
  const hex = counter.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}`;
}

function nextId<T extends string>(): T {
  return nextRawId() as T;
}

export function resetIdCounter(): void {
  counter = 0;
}

export function makeProject(
  overrides: Partial<Project> & { title: string },
): Project {
  return {
    id: nextId<ProjectId>(),
    description: "",
    genre: "",
    targetWordCount: 0,
    mode: "prose",
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeCharacter(
  overrides: Partial<Character> & { projectId: ProjectId; name: string },
): Character {
  return {
    id: nextId<CharacterId>(),
    role: "supporting",
    pronouns: "",
    aliases: [],
    description: "",
    personality: "",
    motivations: "",
    internalConflict: "",
    strengths: "",
    weaknesses: "",
    characterArcs: "",
    dialogueStyle: "",
    backstory: "",
    notes: "",
    linkedCharacterIds: [],
    linkedLocationIds: [],
    images: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeLocation(
  overrides: Partial<Location> & { projectId: ProjectId; name: string },
): Location {
  return {
    id: nextId<LocationId>(),
    description: "",
    parentLocationId: null,
    notes: "",
    linkedCharacterIds: [],
    images: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeTimelineEvent(
  overrides: Partial<TimelineEvent> & { projectId: ProjectId; title: string },
): TimelineEvent {
  return {
    id: nextId<TimelineEventId>(),
    description: "",
    date: "",
    order: 0,
    linkedChapterIds: [],
    linkedCharacterIds: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeStyleGuideEntry(
  overrides: Partial<StyleGuideEntry> & { projectId: ProjectId; title: string },
): StyleGuideEntry {
  return {
    id: nextId<StyleGuideEntryId>(),
    category: "custom",
    content: "",
    order: 0,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeWorldbuildingDoc(
  overrides: Partial<WorldbuildingDoc> & {
    projectId: ProjectId;
    title: string;
  },
): WorldbuildingDoc {
  return {
    id: nextId<WorldbuildingDocId>(),
    content: "",
    tags: [],
    parentDocId: null,
    order: 0,
    linkedCharacterIds: [],
    linkedLocationIds: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeChapter(
  overrides: Partial<Chapter> & { projectId: ProjectId; title: string },
): Chapter {
  return {
    id: nextId<ChapterId>(),
    order: 0,
    content: "",
    synopsis: "",
    status: "draft",
    wordCount: 0,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeOutlineGridColumn(
  overrides: Partial<OutlineGridColumn> & {
    projectId: ProjectId;
    title: string;
  },
): OutlineGridColumn {
  return {
    id: nextId<OutlineGridColumnId>(),
    order: 0,
    width: 200,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeOutlineGridRow(
  overrides: Partial<OutlineGridRow> & { projectId: ProjectId },
): OutlineGridRow {
  return {
    id: nextId<OutlineGridRowId>(),
    linkedChapterId: null,
    label: "",
    order: 0,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeOutlineGridCell(
  overrides: Partial<OutlineGridCell> & {
    projectId: ProjectId;
    rowId: OutlineGridRowId;
    columnId: OutlineGridColumnId;
  },
): OutlineGridCell {
  return {
    id: nextId<OutlineGridCellId>(),
    content: "",
    color: "white",
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeRelationship(
  overrides: Partial<CharacterRelationship> & {
    projectId: ProjectId;
    sourceCharacterId: CharacterId;
    targetCharacterId: CharacterId;
    type: CharacterRelationship["type"];
  },
): CharacterRelationship {
  return {
    id: nextId<CharacterRelationshipId>(),
    customLabel: "",
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}
