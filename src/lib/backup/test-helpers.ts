import { db } from "@/db/database";
import type {
  AppDictionary,
  ChapterId,
  ChapterSnapshot,
  ChapterSnapshotId,
  PlaylistTrack,
  PlaylistTrackId,
  ProjectDictionary,
  ProjectDictionaryId,
  ProjectId,
} from "@/db/schemas";
import {
  makeChapter,
  makeCharacter,
  makeComment,
  makeGuardrailEntry,
  makeLocation,
  makeOutlineGridCell,
  makeOutlineGridColumn,
  makeOutlineGridRow,
  makeProject,
  makeRelationship,
  makeStyleGuideEntry,
  makeTimelineEvent,
  makeWorldbuildingDoc,
  makeWritingSession,
  makeWritingSprint,
} from "@/test/helpers";
import type { ProjectBackupData } from "./types";

const ts = "2024-01-01T00:00:00.000Z";

export function makeAppDictionary(
  overrides?: Partial<AppDictionary>,
): AppDictionary {
  return {
    id: "app-dictionary",
    words: [],
    updatedAt: ts,
    ...overrides,
  };
}

export function makeProjectDictionary(
  overrides: Partial<ProjectDictionary> & { projectId: ProjectId },
): ProjectDictionary {
  return {
    id: crypto.randomUUID() as ProjectDictionaryId,
    words: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makePlaylistTrack(
  overrides: Partial<PlaylistTrack> & { projectId: ProjectId },
): PlaylistTrack {
  return {
    id: crypto.randomUUID() as PlaylistTrackId,
    title: "Test Track",
    url: "https://youtube.com/watch?v=test",
    source: "youtube",
    thumbnailUrl: "",
    duration: 180,
    order: 0,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

export function makeChapterSnapshot(
  overrides: Partial<ChapterSnapshot> & {
    chapterId: ChapterId;
    projectId: ProjectId;
  },
): ChapterSnapshot {
  return {
    id: crypto.randomUUID() as ChapterSnapshotId,
    name: "Snapshot 1",
    content: "snapshot content",
    wordCount: 2,
    createdAt: ts,
    ...overrides,
  };
}

/** Build a full ProjectBackupData for testing. */
export function buildTestProjectData(projectId: ProjectId): ProjectBackupData {
  const chapter = makeChapter({ projectId, title: "Chapter 1" });
  const char1 = makeCharacter({ projectId, name: "Hero" });
  const char2 = makeCharacter({
    projectId,
    name: "Villain",
    linkedCharacterIds: [],
  });
  const location = makeLocation({
    projectId,
    name: "Castle",
    linkedCharacterIds: [char1.id],
  });
  const relationship = makeRelationship({
    projectId,
    sourceCharacterId: char1.id,
    targetCharacterId: char2.id,
    type: "custom",
  });
  const timeline = makeTimelineEvent({
    projectId,
    title: "Battle",
    linkedChapterIds: [chapter.id],
    linkedCharacterIds: [char1.id],
  });
  const styleGuide = makeStyleGuideEntry({ projectId, title: "Rule 1" });
  const guardrail = makeGuardrailEntry({
    projectId,
    label: "No filler comparisons",
    flags: ["the way a [comparison]"],
    fix: "Name what is present.",
    positiveFix: "Use the concrete detail.",
  });
  const worldDoc = makeWorldbuildingDoc({
    projectId,
    title: "Lore",
    linkedCharacterIds: [char1.id],
    linkedLocationIds: [location.id],
  });
  const col = makeOutlineGridColumn({ projectId, title: "Plot" });
  const row = makeOutlineGridRow({ projectId, linkedChapterId: chapter.id });
  const cell = makeOutlineGridCell({
    projectId,
    rowId: row.id,
    columnId: col.id,
    content: "cell content",
  });
  const sprint = makeWritingSprint({ projectId });
  const session = makeWritingSession({ projectId, chapterId: chapter.id });
  const track = makePlaylistTrack({ projectId });
  const comment = makeComment({ projectId, chapterId: chapter.id });
  const snapshot = makeChapterSnapshot({ projectId, chapterId: chapter.id });
  const projectDict = makeProjectDictionary({
    projectId,
    words: ["worldbuilding"],
  });

  return {
    project: makeProject({ id: projectId, title: "Test Novel" }),
    chapters: [chapter],
    characters: [char1, char2],
    characterRelationships: [relationship],
    locations: [location],
    timelineEvents: [timeline],
    styleGuideEntries: [styleGuide],
    guardrailEntries: [guardrail],
    worldbuildingDocs: [worldDoc],
    outlineGridColumns: [col],
    outlineGridRows: [row],
    outlineGridCells: [cell],
    writingSprints: [sprint],
    writingSessions: [session],
    playlistTracks: [track],
    comments: [comment],
    chapterSnapshots: [snapshot],
    projectDictionary: projectDict,
    scenes: [],
  };
}

/** Insert every field of a ProjectBackupData into the database. */
export async function seedProjectData(data: ProjectBackupData): Promise<void> {
  await db.projects.add(data.project);
  await db.chapters.bulkAdd(data.chapters);
  await db.characters.bulkAdd(data.characters);
  await db.characterRelationships.bulkAdd(data.characterRelationships);
  await db.locations.bulkAdd(data.locations);
  await db.timelineEvents.bulkAdd(data.timelineEvents);
  await db.styleGuideEntries.bulkAdd(data.styleGuideEntries);
  await db.guardrailEntries.bulkAdd(data.guardrailEntries);
  await db.worldbuildingDocs.bulkAdd(data.worldbuildingDocs);
  await db.outlineGridColumns.bulkAdd(data.outlineGridColumns);
  await db.outlineGridRows.bulkAdd(data.outlineGridRows);
  await db.outlineGridCells.bulkAdd(data.outlineGridCells);
  await db.writingSprints.bulkAdd(data.writingSprints);
  await db.writingSessions.bulkAdd(data.writingSessions);
  await db.playlistTracks.bulkAdd(data.playlistTracks);
  await db.comments.bulkAdd(data.comments);
  await db.chapterSnapshots.bulkAdd(data.chapterSnapshots);
  if (data.projectDictionary) {
    await db.projectDictionaries.add(data.projectDictionary);
  }
}

export async function clearAllTables(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}
