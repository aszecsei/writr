import { APP_SETTINGS_ID } from "@/lib/constants";
import { generateId } from "@/lib/id";
import { db } from "./database";
import {
  type AppSettings,
  AppSettingsSchema,
  type Chapter,
  ChapterSchema,
  type Character,
  CharacterSchema,
  type Location,
  LocationSchema,
  type Project,
  ProjectSchema,
  type StyleGuideEntry,
  StyleGuideEntrySchema,
  type TimelineEvent,
  TimelineEventSchema,
  type WorldbuildingDoc,
  WorldbuildingDocSchema,
} from "./schemas";

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
    ],
    async () => {
      await db.chapters.where({ projectId: id }).delete();
      await db.characters.where({ projectId: id }).delete();
      await db.locations.where({ projectId: id }).delete();
      await db.timelineEvents.where({ projectId: id }).delete();
      await db.styleGuideEntries.where({ projectId: id }).delete();
      await db.worldbuildingDocs.where({ projectId: id }).delete();
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
  await db.chapters.update(id, { content, wordCount, updatedAt: now() });
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
        | "aliases"
        | "description"
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
    aliases: data.aliases ?? [],
    description: data.description ?? "",
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
  await db.characters.delete(id);
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
  return db.worldbuildingDocs.where({ projectId }).sortBy("title");
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
        "content" | "tags" | "linkedCharacterIds" | "linkedLocationIds"
      >
    >,
): Promise<WorldbuildingDoc> {
  const doc = WorldbuildingDocSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    title: data.title,
    content: data.content ?? "",
    tags: data.tags ?? [],
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
  await db.worldbuildingDocs.update(id, { ...data, updatedAt: now() });
}

export async function deleteWorldbuildingDoc(id: string): Promise<void> {
  await db.worldbuildingDocs.delete(id);
}

// ─── App Settings ───────────────────────────────────────────────────

export async function getAppSettings(): Promise<AppSettings> {
  const existing = await db.appSettings.get(APP_SETTINGS_ID);
  if (existing) return existing;
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
