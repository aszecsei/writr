import type {
  Chapter,
  Character,
  CharacterRelationship,
  Location,
  OutlineGridCell,
  OutlineGridColumn,
  OutlineGridRow,
  StyleGuideEntry,
  TimelineEvent,
  WorldbuildingDoc,
} from "@/db/schemas";

const ts = "2024-01-01T00:00:00.000Z";
let counter = 0;

function nextId(): string {
  counter++;
  const hex = counter.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}`;
}

export function resetIdCounter(): void {
  counter = 0;
}

export function makeCharacter(
  overrides: Partial<Character> & { projectId: string; name: string },
): Character {
  return {
    id: nextId(),
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
  overrides: Partial<Location> & { projectId: string; name: string },
): Location {
  return {
    id: nextId(),
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
  overrides: Partial<TimelineEvent> & { projectId: string; title: string },
): TimelineEvent {
  return {
    id: nextId(),
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
  overrides: Partial<StyleGuideEntry> & { projectId: string; title: string },
): StyleGuideEntry {
  return {
    id: nextId(),
    category: "custom",
    content: "",
    order: 0,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeWorldbuildingDoc(
  overrides: Partial<WorldbuildingDoc> & { projectId: string; title: string },
): WorldbuildingDoc {
  return {
    id: nextId(),
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
  overrides: Partial<Chapter> & { projectId: string; title: string },
): Chapter {
  return {
    id: nextId(),
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
  overrides: Partial<OutlineGridColumn> & { projectId: string; title: string },
): OutlineGridColumn {
  return {
    id: nextId(),
    order: 0,
    width: 200,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeOutlineGridRow(
  overrides: Partial<OutlineGridRow> & { projectId: string },
): OutlineGridRow {
  return {
    id: nextId(),
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
    projectId: string;
    rowId: string;
    columnId: string;
  },
): OutlineGridCell {
  return {
    id: nextId(),
    content: "",
    color: "white",
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeRelationship(
  overrides: Partial<CharacterRelationship> & {
    projectId: string;
    sourceCharacterId: string;
    targetCharacterId: string;
    type: CharacterRelationship["type"];
  },
): CharacterRelationship {
  return {
    id: nextId(),
    customLabel: "",
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}
