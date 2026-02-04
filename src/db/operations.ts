import { APP_SETTINGS_ID } from "@/lib/constants";
import { generateId } from "@/lib/id";
import { db } from "./database";
import {
  type AppSettings,
  AppSettingsSchema,
  type Chapter,
  ChapterSchema,
  type Character,
  type CharacterRelationship,
  CharacterRelationshipSchema,
  CharacterSchema,
  type Location,
  LocationSchema,
  type OutlineGridCell,
  OutlineGridCellSchema,
  type OutlineGridColumn,
  OutlineGridColumnSchema,
  type OutlineGridRow,
  OutlineGridRowSchema,
  type PlaylistTrack,
  PlaylistTrackSchema,
  type Project,
  ProjectSchema,
  type StyleGuideEntry,
  StyleGuideEntrySchema,
  type TimelineEvent,
  TimelineEventSchema,
  type WorldbuildingDoc,
  WorldbuildingDocSchema,
  type WritingSession,
  WritingSessionSchema,
  type WritingSprint,
  WritingSprintSchema,
} from "./schemas";

// Re-export sync functions for backward compatibility
export {
  createChapterFromRow,
  getLinkedRow,
  hasLinkedChapter,
  hasLinkedRow,
  linkChapterToRow,
  syncDeleteChapter,
  syncDeleteOutlineRow,
  syncReorderChapters,
  syncReorderOutlineRows,
  unlinkChapterFromRow,
  updateRowLabel,
} from "./chapter-outline-sync";

function now(): string {
  return new Date().toISOString();
}

// ─── Projects ────────────────────────────────────────────────────────

export async function createProject(
  data: Pick<Project, "title"> &
    Partial<Pick<Project, "description" | "genre" | "targetWordCount">>,
): Promise<Project> {
  const project = ProjectSchema.parse({
    id: generateId(),
    title: data.title,
    description: data.description ?? "",
    genre: data.genre ?? "",
    targetWordCount: data.targetWordCount ?? 0,
    createdAt: now(),
    updatedAt: now(),
  });
  await db.projects.add(project);
  return project;
}

export async function updateProject(
  id: string,
  data: Partial<
    Pick<Project, "title" | "description" | "genre" | "targetWordCount">
  >,
): Promise<void> {
  await db.projects.update(id, { ...data, updatedAt: now() });
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.projects,
      db.chapters,
      db.characters,
      db.locations,
      db.timelineEvents,
      db.styleGuideEntries,
      db.worldbuildingDocs,
      db.characterRelationships,
      db.outlineGridColumns,
      db.outlineGridRows,
      db.outlineGridCells,
      db.writingSprints,
      db.writingSessions,
      db.playlistTracks,
    ],
    async () => {
      await db.chapters.where({ projectId: id }).delete();
      await db.characters.where({ projectId: id }).delete();
      await db.locations.where({ projectId: id }).delete();
      await db.timelineEvents.where({ projectId: id }).delete();
      await db.styleGuideEntries.where({ projectId: id }).delete();
      await db.worldbuildingDocs.where({ projectId: id }).delete();
      await db.characterRelationships.where({ projectId: id }).delete();
      await db.outlineGridColumns.where({ projectId: id }).delete();
      await db.outlineGridRows.where({ projectId: id }).delete();
      await db.outlineGridCells.where({ projectId: id }).delete();
      await db.writingSprints.where({ projectId: id }).delete();
      await db.writingSessions.where({ projectId: id }).delete();
      await db.playlistTracks.where({ projectId: id }).delete();
      await db.projects.delete(id);
    },
  );
}

export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function getAllProjects(): Promise<Project[]> {
  return db.projects.orderBy("updatedAt").reverse().toArray();
}

// ─── Chapters ────────────────────────────────────────────────────────

export async function getChaptersByProject(
  projectId: string,
): Promise<Chapter[]> {
  return db.chapters.where({ projectId }).sortBy("order");
}

export async function getChapter(id: string): Promise<Chapter | undefined> {
  return db.chapters.get(id);
}

export async function createChapter(
  data: Pick<Chapter, "projectId" | "title"> &
    Partial<Pick<Chapter, "order" | "content" | "synopsis">>,
): Promise<Chapter> {
  const order =
    data.order ??
    (await db.chapters.where({ projectId: data.projectId }).count());
  const chapter = ChapterSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    title: data.title,
    order,
    content: data.content ?? "",
    synopsis: data.synopsis ?? "",
    status: "draft",
    wordCount: 0,
    createdAt: now(),
    updatedAt: now(),
  });
  await db.chapters.add(chapter);
  return chapter;
}

export async function updateChapter(
  id: string,
  data: Partial<Pick<Chapter, "title" | "synopsis" | "status">>,
): Promise<void> {
  await db.chapters.update(id, { ...data, updatedAt: now() });
}

export async function updateChapterContent(
  id: string,
  content: string,
  wordCount: number,
): Promise<void> {
  const chapter = await db.chapters.get(id);
  const previousWordCount = chapter?.wordCount ?? 0;

  await db.chapters.update(id, { content, wordCount, updatedAt: now() });

  // Record writing session if word count changed
  if (chapter && wordCount !== previousWordCount) {
    recordWritingSession(chapter.projectId, id, previousWordCount, wordCount);
  }
}

export async function reorderChapters(orderedIds: string[]): Promise<void> {
  await db.transaction("rw", db.chapters, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.chapters.update(orderedIds[i], { order: i });
    }
  });
}

export async function deleteChapter(id: string): Promise<void> {
  await db.chapters.delete(id);
}

// ─── Characters ──────────────────────────────────────────────────────

export async function getCharactersByProject(
  projectId: string,
): Promise<Character[]> {
  return db.characters.where({ projectId }).sortBy("name");
}

export async function getCharacter(id: string): Promise<Character | undefined> {
  return db.characters.get(id);
}

export async function createCharacter(
  data: Pick<Character, "projectId" | "name"> &
    Partial<
      Pick<
        Character,
        | "role"
        | "pronouns"
        | "aliases"
        | "description"
        | "personality"
        | "motivations"
        | "internalConflict"
        | "strengths"
        | "weaknesses"
        | "characterArcs"
        | "dialogueStyle"
        | "backstory"
        | "notes"
        | "linkedCharacterIds"
        | "linkedLocationIds"
      >
    >,
): Promise<Character> {
  const character = CharacterSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    name: data.name,
    role: data.role ?? "supporting",
    pronouns: data.pronouns ?? "",
    aliases: data.aliases ?? [],
    description: data.description ?? "",
    personality: data.personality ?? "",
    motivations: data.motivations ?? "",
    internalConflict: data.internalConflict ?? "",
    strengths: data.strengths ?? "",
    weaknesses: data.weaknesses ?? "",
    characterArcs: data.characterArcs ?? "",
    dialogueStyle: data.dialogueStyle ?? "",
    backstory: data.backstory ?? "",
    notes: data.notes ?? "",
    linkedCharacterIds: data.linkedCharacterIds ?? [],
    linkedLocationIds: data.linkedLocationIds ?? [],
    createdAt: now(),
    updatedAt: now(),
  });
  await db.characters.add(character);
  return character;
}

export async function updateCharacter(
  id: string,
  data: Partial<Omit<Character, "id" | "projectId" | "createdAt">>,
): Promise<void> {
  await db.characters.update(id, { ...data, updatedAt: now() });
}

export async function deleteCharacter(id: string): Promise<void> {
  await db.transaction(
    "rw",
    [db.characters, db.characterRelationships],
    async () => {
      await db.characterRelationships
        .where("sourceCharacterId")
        .equals(id)
        .delete();
      await db.characterRelationships
        .where("targetCharacterId")
        .equals(id)
        .delete();
      await db.characters.delete(id);
    },
  );
}

// ─── Locations ───────────────────────────────────────────────────────

export async function getLocationsByProject(
  projectId: string,
): Promise<Location[]> {
  return db.locations.where({ projectId }).sortBy("name");
}

export async function getLocation(id: string): Promise<Location | undefined> {
  return db.locations.get(id);
}

export async function createLocation(
  data: Pick<Location, "projectId" | "name"> &
    Partial<
      Pick<
        Location,
        "description" | "parentLocationId" | "notes" | "linkedCharacterIds"
      >
    >,
): Promise<Location> {
  const location = LocationSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    name: data.name,
    description: data.description ?? "",
    parentLocationId: data.parentLocationId ?? null,
    notes: data.notes ?? "",
    linkedCharacterIds: data.linkedCharacterIds ?? [],
    createdAt: now(),
    updatedAt: now(),
  });
  await db.locations.add(location);
  return location;
}

export async function updateLocation(
  id: string,
  data: Partial<Omit<Location, "id" | "projectId" | "createdAt">>,
): Promise<void> {
  await db.locations.update(id, { ...data, updatedAt: now() });
}

export async function deleteLocation(id: string): Promise<void> {
  await db.locations.delete(id);
}

// ─── Timeline Events ────────────────────────────────────────────────

export async function getTimelineByProject(
  projectId: string,
): Promise<TimelineEvent[]> {
  return db.timelineEvents.where({ projectId }).sortBy("order");
}

export async function getTimelineEvent(
  id: string,
): Promise<TimelineEvent | undefined> {
  return db.timelineEvents.get(id);
}

export async function createTimelineEvent(
  data: Pick<TimelineEvent, "projectId" | "title"> &
    Partial<
      Pick<
        TimelineEvent,
        | "description"
        | "date"
        | "order"
        | "linkedChapterIds"
        | "linkedCharacterIds"
      >
    >,
): Promise<TimelineEvent> {
  const order =
    data.order ??
    (await db.timelineEvents.where({ projectId: data.projectId }).count());
  const event = TimelineEventSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    title: data.title,
    description: data.description ?? "",
    date: data.date ?? "",
    order,
    linkedChapterIds: data.linkedChapterIds ?? [],
    linkedCharacterIds: data.linkedCharacterIds ?? [],
    createdAt: now(),
    updatedAt: now(),
  });
  await db.timelineEvents.add(event);
  return event;
}

export async function updateTimelineEvent(
  id: string,
  data: Partial<Omit<TimelineEvent, "id" | "projectId" | "createdAt">>,
): Promise<void> {
  await db.timelineEvents.update(id, { ...data, updatedAt: now() });
}

export async function deleteTimelineEvent(id: string): Promise<void> {
  await db.timelineEvents.delete(id);
}

export async function reorderTimelineEvents(
  orderedIds: string[],
): Promise<void> {
  await db.transaction("rw", db.timelineEvents, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.timelineEvents.update(orderedIds[i], { order: i });
    }
  });
}

// ─── Style Guide Entries ────────────────────────────────────────────

export async function getStyleGuideByProject(
  projectId: string,
): Promise<StyleGuideEntry[]> {
  return db.styleGuideEntries.where({ projectId }).sortBy("order");
}

export async function getStyleGuideEntry(
  id: string,
): Promise<StyleGuideEntry | undefined> {
  return db.styleGuideEntries.get(id);
}

export async function createStyleGuideEntry(
  data: Pick<StyleGuideEntry, "projectId" | "title"> &
    Partial<Pick<StyleGuideEntry, "category" | "content" | "order">>,
): Promise<StyleGuideEntry> {
  const order =
    data.order ??
    (await db.styleGuideEntries.where({ projectId: data.projectId }).count());
  const entry = StyleGuideEntrySchema.parse({
    id: generateId(),
    projectId: data.projectId,
    category: data.category ?? "custom",
    title: data.title,
    content: data.content ?? "",
    order,
    createdAt: now(),
    updatedAt: now(),
  });
  await db.styleGuideEntries.add(entry);
  return entry;
}

export async function updateStyleGuideEntry(
  id: string,
  data: Partial<Omit<StyleGuideEntry, "id" | "projectId" | "createdAt">>,
): Promise<void> {
  await db.styleGuideEntries.update(id, { ...data, updatedAt: now() });
}

export async function deleteStyleGuideEntry(id: string): Promise<void> {
  await db.styleGuideEntries.delete(id);
}

// ─── Worldbuilding Docs ─────────────────────────────────────────────

export async function getWorldbuildingDocsByProject(
  projectId: string,
): Promise<WorldbuildingDoc[]> {
  return db.worldbuildingDocs.where({ projectId }).sortBy("order");
}

export async function getWorldbuildingDoc(
  id: string,
): Promise<WorldbuildingDoc | undefined> {
  return db.worldbuildingDocs.get(id);
}

export async function createWorldbuildingDoc(
  data: Pick<WorldbuildingDoc, "projectId" | "title"> &
    Partial<
      Pick<
        WorldbuildingDoc,
        | "content"
        | "tags"
        | "parentDocId"
        | "order"
        | "linkedCharacterIds"
        | "linkedLocationIds"
      >
    >,
): Promise<WorldbuildingDoc> {
  const parentDocId = data.parentDocId ?? null;
  const order =
    data.order ??
    (await db.worldbuildingDocs
      .where({ projectId: data.projectId })
      .filter((d) => d.parentDocId === parentDocId)
      .count());
  const doc = WorldbuildingDocSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    title: data.title,
    content: data.content ?? "",
    tags: data.tags ?? [],
    parentDocId,
    order,
    linkedCharacterIds: data.linkedCharacterIds ?? [],
    linkedLocationIds: data.linkedLocationIds ?? [],
    createdAt: now(),
    updatedAt: now(),
  });
  await db.worldbuildingDocs.add(doc);
  return doc;
}

export async function updateWorldbuildingDoc(
  id: string,
  data: Partial<Omit<WorldbuildingDoc, "id" | "projectId" | "createdAt">>,
): Promise<void> {
  // Cycle detection when changing parentDocId
  if (data.parentDocId !== undefined) {
    let cursor = data.parentDocId;
    while (cursor) {
      if (cursor === id) {
        throw new Error(
          "Cannot move a document under one of its own children.",
        );
      }
      const parent = await db.worldbuildingDocs.get(cursor);
      cursor = parent?.parentDocId ?? null;
    }
  }
  await db.worldbuildingDocs.update(id, { ...data, updatedAt: now() });
}

export async function deleteWorldbuildingDoc(id: string): Promise<void> {
  const doc = await db.worldbuildingDocs.get(id);
  if (!doc) return;
  const newParent = doc.parentDocId;
  await db.transaction("rw", db.worldbuildingDocs, async () => {
    // Re-parent children to deleted doc's parent
    await db.worldbuildingDocs
      .where({ parentDocId: id })
      .modify({ parentDocId: newParent });
    await db.worldbuildingDocs.delete(id);
  });
}

export async function reorderWorldbuildingDocs(
  orderedIds: string[],
): Promise<void> {
  await db.transaction("rw", db.worldbuildingDocs, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.worldbuildingDocs.update(orderedIds[i], { order: i });
    }
  });
}

// ─── Character Relationships ────────────────────────────────────────

export async function getRelationshipsByProject(
  projectId: string,
): Promise<CharacterRelationship[]> {
  return db.characterRelationships.where({ projectId }).toArray();
}

export async function createRelationship(
  data: Pick<
    CharacterRelationship,
    "projectId" | "sourceCharacterId" | "targetCharacterId" | "type"
  > &
    Partial<Pick<CharacterRelationship, "customLabel">>,
): Promise<CharacterRelationship> {
  if (data.sourceCharacterId === data.targetCharacterId) {
    throw new Error("A character cannot have a relationship with itself.");
  }

  // Prevent exact duplicates (same pair + type + label)
  const existing = await db.characterRelationships
    .where({ projectId: data.projectId })
    .toArray();

  const customLabel = data.customLabel ?? "";
  const isDuplicate = existing.some(
    (r) =>
      r.type === data.type &&
      r.customLabel === customLabel &&
      ((r.sourceCharacterId === data.sourceCharacterId &&
        r.targetCharacterId === data.targetCharacterId) ||
        (r.sourceCharacterId === data.targetCharacterId &&
          r.targetCharacterId === data.sourceCharacterId)),
  );

  if (isDuplicate) {
    throw new Error("This exact relationship already exists.");
  }

  const relationship = CharacterRelationshipSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    sourceCharacterId: data.sourceCharacterId,
    targetCharacterId: data.targetCharacterId,
    type: data.type,
    customLabel,
    createdAt: now(),
    updatedAt: now(),
  });
  await db.characterRelationships.add(relationship);
  return relationship;
}

export async function updateRelationship(
  id: string,
  data: Partial<Pick<CharacterRelationship, "type" | "customLabel">>,
): Promise<void> {
  await db.characterRelationships.update(id, { ...data, updatedAt: now() });
}

export async function deleteRelationship(id: string): Promise<void> {
  await db.characterRelationships.delete(id);
}

// ─── App Settings ───────────────────────────────────────────────────

export async function getAppSettings(): Promise<AppSettings> {
  const existing = await db.appSettings.get(APP_SETTINGS_ID);
  if (existing) return AppSettingsSchema.parse(existing);
  const defaults = AppSettingsSchema.parse({
    id: APP_SETTINGS_ID,
    updatedAt: now(),
  });
  await db.appSettings.add(defaults);
  return defaults;
}

export async function updateAppSettings(
  data: Partial<Omit<AppSettings, "id">>,
): Promise<void> {
  await db.appSettings.update(APP_SETTINGS_ID, {
    ...data,
    updatedAt: now(),
  });
}

// ─── Writing Sprints ────────────────────────────────────────────────

export async function getActiveSprint(): Promise<WritingSprint | undefined> {
  return db.writingSprints.where("status").anyOf(["active", "paused"]).first();
}

export async function createSprint(
  data: Pick<WritingSprint, "durationMs" | "startWordCount"> &
    Partial<Pick<WritingSprint, "projectId" | "chapterId" | "wordCountGoal">>,
): Promise<WritingSprint> {
  const existing = await getActiveSprint();
  if (existing) {
    throw new Error(
      "A sprint is already active. End it before starting a new one.",
    );
  }

  const sprint = WritingSprintSchema.parse({
    id: generateId(),
    projectId: data.projectId ?? null,
    chapterId: data.chapterId ?? null,
    durationMs: data.durationMs,
    wordCountGoal: data.wordCountGoal ?? null,
    status: "active",
    startedAt: now(),
    pausedAt: null,
    endedAt: null,
    totalPausedMs: 0,
    startWordCount: data.startWordCount,
    endWordCount: null,
    createdAt: now(),
    updatedAt: now(),
  });
  await db.writingSprints.add(sprint);
  return sprint;
}

export async function pauseSprint(id: string): Promise<void> {
  const sprint = await db.writingSprints.get(id);
  if (!sprint) throw new Error("Sprint not found.");
  if (sprint.status !== "active") throw new Error("Sprint is not active.");

  await db.writingSprints.update(id, {
    status: "paused",
    pausedAt: now(),
    updatedAt: now(),
  });
}

export async function resumeSprint(id: string): Promise<void> {
  const sprint = await db.writingSprints.get(id);
  if (!sprint) throw new Error("Sprint not found.");
  if (sprint.status !== "paused") throw new Error("Sprint is not paused.");
  if (!sprint.pausedAt) throw new Error("Sprint has no pausedAt timestamp.");

  const pausedDuration = Date.now() - new Date(sprint.pausedAt).getTime();
  await db.writingSprints.update(id, {
    status: "active",
    pausedAt: null,
    totalPausedMs: sprint.totalPausedMs + pausedDuration,
    updatedAt: now(),
  });
}

export async function endSprint(
  id: string,
  endWordCount: number,
  abandoned = false,
): Promise<void> {
  const sprint = await db.writingSprints.get(id);
  if (!sprint) throw new Error("Sprint not found.");
  if (sprint.status === "completed" || sprint.status === "abandoned") {
    throw new Error("Sprint is already ended.");
  }

  let totalPausedMs = sprint.totalPausedMs;
  if (sprint.status === "paused" && sprint.pausedAt) {
    totalPausedMs += Date.now() - new Date(sprint.pausedAt).getTime();
  }

  await db.writingSprints.update(id, {
    status: abandoned ? "abandoned" : "completed",
    endedAt: now(),
    endWordCount,
    totalPausedMs,
    pausedAt: null,
    updatedAt: now(),
  });
}

export async function getSprintsByProject(
  projectId: string | null,
  limit?: number,
): Promise<WritingSprint[]> {
  let query = projectId
    ? db.writingSprints.where({ projectId }).reverse()
    : db.writingSprints.orderBy("startedAt").reverse();

  query = query.filter(
    (s) => s.status === "completed" || s.status === "abandoned",
  );

  if (limit) {
    return query.limit(limit).toArray();
  }
  return query.toArray();
}

export async function getAllCompletedSprints(
  limit?: number,
): Promise<WritingSprint[]> {
  const query = db.writingSprints
    .orderBy("startedAt")
    .reverse()
    .filter((s) => s.status === "completed" || s.status === "abandoned");

  if (limit) {
    return query.limit(limit).toArray();
  }
  return query.toArray();
}

export async function deleteSprint(id: string): Promise<void> {
  await db.writingSprints.delete(id);
}

// ─── Writing Sessions ────────────────────────────────────────────────

// Session tracking state - tracks ongoing sessions within the same hour
const sessionCache = new Map<
  string,
  { sessionId: string; wordCountStart: number; lastUpdate: number }
>();

// How long before a session is considered stale (5 minutes)
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

/** Clears the session cache. Exported for test cleanup. */
export function clearSessionCache(): void {
  sessionCache.clear();
}

/**
 * Records a writing session for a chapter.
 * If a session exists for the same chapter in the same hour and is recent,
 * it will be extended. Otherwise, a new session is created.
 */
export async function recordWritingSession(
  projectId: string,
  chapterId: string,
  previousWordCount: number,
  newWordCount: number,
): Promise<void> {
  const timestamp = new Date();
  const date = timestamp.toISOString().slice(0, 10); // YYYY-MM-DD
  const hourOfDay = timestamp.getHours();
  const cacheKey = `${chapterId}-${date}-${hourOfDay}`;

  const cached = sessionCache.get(cacheKey);
  const timeSinceLastUpdate = cached ? Date.now() - cached.lastUpdate : 0;

  if (cached && timeSinceLastUpdate < SESSION_TIMEOUT_MS) {
    // Extend existing session
    await db.writingSessions.update(cached.sessionId, {
      wordCountEnd: newWordCount,
      durationMs:
        ((await db.writingSessions.get(cached.sessionId))?.durationMs ?? 0) +
        timeSinceLastUpdate,
      updatedAt: now(),
    });
    sessionCache.set(cacheKey, {
      ...cached,
      lastUpdate: Date.now(),
    });
  } else {
    // Create new session
    const session = WritingSessionSchema.parse({
      id: generateId(),
      projectId,
      chapterId,
      date,
      hourOfDay,
      wordCountStart: previousWordCount,
      wordCountEnd: newWordCount,
      durationMs: 0,
      createdAt: now(),
      updatedAt: now(),
    });
    await db.writingSessions.add(session);
    sessionCache.set(cacheKey, {
      sessionId: session.id,
      wordCountStart: previousWordCount,
      lastUpdate: Date.now(),
    });
  }
}

export async function getSessionsByProject(
  projectId: string,
  days = 30,
): Promise<WritingSession[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  return db.writingSessions
    .where("[projectId+date]")
    .between([projectId, cutoffStr], [projectId, "\uffff"])
    .toArray();
}

export async function getAllSessions(days = 30): Promise<WritingSession[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  return db.writingSessions.where("date").aboveOrEqual(cutoffStr).toArray();
}

// ─── Outline Grid Columns ────────────────────────────────────────────

export async function getOutlineGridColumnsByProject(
  projectId: string,
): Promise<OutlineGridColumn[]> {
  return db.outlineGridColumns.where({ projectId }).sortBy("order");
}

export async function createOutlineGridColumn(
  data: Pick<OutlineGridColumn, "projectId" | "title"> &
    Partial<Pick<OutlineGridColumn, "order" | "width">>,
): Promise<OutlineGridColumn> {
  const order =
    data.order ??
    (await db.outlineGridColumns.where({ projectId: data.projectId }).count());
  const column = OutlineGridColumnSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    title: data.title,
    order,
    width: data.width ?? 200,
    createdAt: now(),
    updatedAt: now(),
  });
  await db.outlineGridColumns.add(column);
  return column;
}

export async function updateOutlineGridColumn(
  id: string,
  data: Partial<Pick<OutlineGridColumn, "title" | "width">>,
): Promise<void> {
  await db.outlineGridColumns.update(id, { ...data, updatedAt: now() });
}

export async function deleteOutlineGridColumn(id: string): Promise<void> {
  await db.transaction(
    "rw",
    [db.outlineGridColumns, db.outlineGridCells],
    async () => {
      await db.outlineGridCells.where({ columnId: id }).delete();
      await db.outlineGridColumns.delete(id);
    },
  );
}

export async function insertOutlineGridColumnAt(
  projectId: string,
  title: string,
  atOrder: number,
): Promise<OutlineGridColumn> {
  return db.transaction("rw", db.outlineGridColumns, async () => {
    // Shift existing columns at and after atOrder
    const columnsToShift = await db.outlineGridColumns
      .where({ projectId })
      .filter((c) => c.order >= atOrder)
      .toArray();
    for (const col of columnsToShift) {
      await db.outlineGridColumns.update(col.id, { order: col.order + 1 });
    }
    // Create new column at the position
    const column = OutlineGridColumnSchema.parse({
      id: generateId(),
      projectId,
      title,
      order: atOrder,
      width: 200,
      createdAt: now(),
      updatedAt: now(),
    });
    await db.outlineGridColumns.add(column);
    return column;
  });
}

export async function reorderOutlineGridColumns(
  orderedIds: string[],
): Promise<void> {
  await db.transaction("rw", db.outlineGridColumns, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.outlineGridColumns.update(orderedIds[i], { order: i });
    }
  });
}

// ─── Outline Grid Rows ───────────────────────────────────────────────

export async function getOutlineGridRowsByProject(
  projectId: string,
): Promise<OutlineGridRow[]> {
  return db.outlineGridRows.where({ projectId }).sortBy("order");
}

export async function createOutlineGridRow(
  data: Pick<OutlineGridRow, "projectId"> &
    Partial<Pick<OutlineGridRow, "linkedChapterId" | "label" | "order">>,
): Promise<OutlineGridRow> {
  const order =
    data.order ??
    (await db.outlineGridRows.where({ projectId: data.projectId }).count());
  const row = OutlineGridRowSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    linkedChapterId: data.linkedChapterId ?? null,
    label: data.label ?? "",
    order,
    createdAt: now(),
    updatedAt: now(),
  });
  await db.outlineGridRows.add(row);
  return row;
}

export async function updateOutlineGridRow(
  id: string,
  data: Partial<Pick<OutlineGridRow, "linkedChapterId" | "label">>,
): Promise<void> {
  await db.outlineGridRows.update(id, { ...data, updatedAt: now() });
}

export async function deleteOutlineGridRow(id: string): Promise<void> {
  await db.transaction(
    "rw",
    [db.outlineGridRows, db.outlineGridCells],
    async () => {
      await db.outlineGridCells.where({ rowId: id }).delete();
      await db.outlineGridRows.delete(id);
    },
  );
}

export async function getOutlineGridRowByChapterId(
  chapterId: string,
): Promise<OutlineGridRow | undefined> {
  return db.outlineGridRows.where({ linkedChapterId: chapterId }).first();
}

export async function insertOutlineGridRowAt(
  projectId: string,
  atOrder: number,
  label = "",
  linkedChapterId: string | null = null,
): Promise<OutlineGridRow> {
  return db.transaction("rw", db.outlineGridRows, async () => {
    // Shift existing rows at and after atOrder
    const rowsToShift = await db.outlineGridRows
      .where({ projectId })
      .filter((r) => r.order >= atOrder)
      .toArray();
    for (const row of rowsToShift) {
      await db.outlineGridRows.update(row.id, { order: row.order + 1 });
    }
    // Create new row at the position
    const row = OutlineGridRowSchema.parse({
      id: generateId(),
      projectId,
      linkedChapterId,
      label,
      order: atOrder,
      createdAt: now(),
      updatedAt: now(),
    });
    await db.outlineGridRows.add(row);
    return row;
  });
}

export async function reorderOutlineGridRows(
  orderedIds: string[],
): Promise<void> {
  await db.transaction("rw", db.outlineGridRows, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.outlineGridRows.update(orderedIds[i], { order: i });
    }
  });
}

// ─── Outline Grid Cells ──────────────────────────────────────────────

export async function getOutlineGridCellsByProject(
  projectId: string,
): Promise<OutlineGridCell[]> {
  return db.outlineGridCells.where({ projectId }).toArray();
}

export async function getOutlineGridCell(
  rowId: string,
  columnId: string,
): Promise<OutlineGridCell | undefined> {
  return db.outlineGridCells
    .where("[rowId+columnId]")
    .equals([rowId, columnId])
    .first();
}

export async function upsertOutlineGridCell(
  data: Pick<OutlineGridCell, "projectId" | "rowId" | "columnId"> &
    Partial<Pick<OutlineGridCell, "content" | "color">>,
): Promise<OutlineGridCell> {
  const existing = await getOutlineGridCell(data.rowId, data.columnId);
  if (existing) {
    await db.outlineGridCells.update(existing.id, {
      content: data.content ?? existing.content,
      color: data.color ?? existing.color,
      updatedAt: now(),
    });
    return { ...existing, ...data, updatedAt: now() };
  }
  const cell = OutlineGridCellSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    rowId: data.rowId,
    columnId: data.columnId,
    content: data.content ?? "",
    color: data.color ?? "white",
    createdAt: now(),
    updatedAt: now(),
  });
  await db.outlineGridCells.add(cell);
  return cell;
}

export async function updateOutlineGridCellColor(
  rowId: string,
  columnId: string,
  color: OutlineGridCell["color"],
): Promise<void> {
  const existing = await getOutlineGridCell(rowId, columnId);
  if (existing) {
    await db.outlineGridCells.update(existing.id, { color, updatedAt: now() });
  }
}

export async function deleteOutlineGridCell(id: string): Promise<void> {
  await db.outlineGridCells.delete(id);
}

// ─── Playlist Tracks ─────────────────────────────────────────────────

export async function getPlaylistByProject(
  projectId: string,
): Promise<PlaylistTrack[]> {
  return db.playlistTracks.where({ projectId }).sortBy("order");
}

export async function getPlaylistTrack(
  id: string,
): Promise<PlaylistTrack | undefined> {
  return db.playlistTracks.get(id);
}

export async function createPlaylistTrack(
  data: Pick<PlaylistTrack, "projectId" | "title" | "url" | "source"> &
    Partial<Pick<PlaylistTrack, "thumbnailUrl" | "duration" | "order">>,
): Promise<PlaylistTrack> {
  const order =
    data.order ??
    (await db.playlistTracks.where({ projectId: data.projectId }).count());
  const track = PlaylistTrackSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    title: data.title,
    url: data.url,
    source: data.source,
    thumbnailUrl: data.thumbnailUrl ?? "",
    duration: data.duration ?? 0,
    order,
    createdAt: now(),
    updatedAt: now(),
  });
  await db.playlistTracks.add(track);
  return track;
}

export async function updatePlaylistTrack(
  id: string,
  data: Partial<
    Pick<
      PlaylistTrack,
      "title" | "url" | "source" | "thumbnailUrl" | "duration"
    >
  >,
): Promise<void> {
  await db.playlistTracks.update(id, { ...data, updatedAt: now() });
}

export async function deletePlaylistTrack(id: string): Promise<void> {
  await db.playlistTracks.delete(id);
}

export async function reorderPlaylistTracks(
  orderedIds: string[],
): Promise<void> {
  await db.transaction("rw", db.playlistTracks, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.playlistTracks.update(orderedIds[i], { order: i });
    }
  });
}
