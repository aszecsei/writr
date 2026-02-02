import type {
  Character,
  CharacterRelationship,
  Location,
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
