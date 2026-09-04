import type {
  BrainstormSetup,
  BrainstormSetupId,
  Chapter,
  ChapterId,
  Character,
  CharacterId,
  CharacterRelationship,
  CharacterRelationshipId,
  Comment,
  CommentId,
  EntityImage,
  EntityImageId,
  GuardrailEntry,
  GuardrailEntryId,
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
  SavedPrompt,
  SavedPromptId,
  Scene,
  SceneId,
  StyleGuideEntry,
  StyleGuideEntryId,
  TimelineEvent,
  TimelineEventId,
  WorldbuildingDoc,
  WorldbuildingDocId,
  WritingSession,
  WritingSessionId,
  WritingSprint,
  WritingSprintId,
} from "@/db/schemas";
import { type AppSettings, AppSettingsSchema } from "@/db/schemas";
import type { AiContext } from "@/lib/ai/types";

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
    coverImageUrl: "",
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
    summary: "",
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
    disabledProjectIds: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeGuardrailEntry(
  overrides: Partial<GuardrailEntry> & { projectId: ProjectId; label: string },
): GuardrailEntry {
  return {
    id: nextId<GuardrailEntryId>(),
    flags: [],
    fix: "",
    positiveFix: "",
    order: 0,
    disabledProjectIds: [],
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
    parentChapterId: null,
    section: "manuscript",
    kind: "document",
    includeInCompile: true,
    pageBreakBefore: false,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeScene(
  overrides: Partial<Scene> & { projectId: ProjectId; chapterId: ChapterId },
): Scene {
  return {
    id: nextId<SceneId>(),
    order: 0,
    title: "",
    status: "draft",
    povCharacterId: null,
    presentCharacterIds: [],
    locationIds: [],
    timelineMode: "linear",
    strands: [],
    storyDate: "",
    storyTime: "",
    targetWordCount: 0,
    wordCount: 0,
    tags: [],
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

export function makeComment(
  overrides: Partial<Comment> & { projectId: ProjectId; chapterId: ChapterId },
): Comment {
  return {
    id: nextId<CommentId>(),
    content: "",
    color: "yellow",
    fromOffset: 0,
    toOffset: 0,
    anchorText: "",
    status: "active",
    resolvedAt: null,
    parentCommentId: null,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeWritingSession(
  overrides: Partial<WritingSession> & {
    projectId: ProjectId;
    chapterId: ChapterId;
  },
): WritingSession {
  return {
    id: nextId<WritingSessionId>(),
    date: "2024-01-01",
    hourOfDay: 0,
    wordCountStart: 0,
    wordCountEnd: 0,
    durationMs: 0,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeWritingSprint(
  overrides: Partial<WritingSprint> = {},
): WritingSprint {
  return {
    id: nextId<WritingSprintId>(),
    projectId: null,
    chapterId: null,
    durationMs: 1500000,
    wordCountGoal: null,
    status: "active",
    startedAt: ts,
    pausedAt: null,
    endedAt: null,
    totalPausedMs: 0,
    startWordCount: 0,
    endWordCount: null,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeSavedPrompt(
  overrides: Partial<SavedPrompt> & { title: string },
): SavedPrompt {
  return {
    id: nextId<SavedPromptId>(),
    projectId: null,
    body: "",
    builtinKey: null,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeBrainstormSetup(
  overrides: Partial<BrainstormSetup> & { name: string },
): BrainstormSetup {
  return {
    id: nextId<BrainstormSetupId>(),
    columns: [],
    pattern: "",
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeImage(overrides: Partial<EntityImage> = {}): EntityImage {
  return {
    id: nextId<EntityImageId>(),
    url: "https://example.com/image.png",
    caption: "",
    isPrimary: false,
    focalX: 0.5,
    focalY: 0,
    ...overrides,
  };
}

export function makeAiContext(overrides: Partial<AiContext> = {}): AiContext {
  return {
    projectTitle: "Test Novel",
    projectDescription: "",
    genre: "",
    styleGuide: [],
    guardrails: [],
    chapters: [],
    ...overrides,
  };
}

export function makeAppSettings(overrides?: Partial<AppSettings>): AppSettings {
  return AppSettingsSchema.parse({
    id: "app-settings",
    updatedAt: ts,
    ...overrides,
  });
}
