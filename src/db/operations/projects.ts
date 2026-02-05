import { db } from "../database";
import { type Project, ProjectSchema } from "../schemas";
import { generateId, now } from "./helpers";

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
      db.comments,
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
      await db.comments.where({ projectId: id }).delete();
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
