import { db } from "../database";
import { type Project, type ProjectId, ProjectSchema } from "../schemas";
import { createCrud, generateId, now, stripUndefined } from "./helpers";

// ─── Projects ────────────────────────────────────────────────────────

// Tables Dexie indexes by `projectId` but that a project delete deliberately
// leaves alone: savedPrompts carries a nullable projectId (global-or-scoped)
// but prompts survive deletion of the project that scoped them; outlineColumns
// and outlineCards are pre-v9 stores superseded by outlineGrid* — no code path
// writes to them any more, but the Dexie version chain never dropped the
// object stores, so they still surface here.
const PROJECT_SCOPED_NOT_CASCADED = new Set([
  "savedPrompts",
  "outlineColumns",
  "outlineCards",
]);

/** Every table cascaded by {@link deleteAllProjectData} and {@link deleteProject}. */
export const PROJECT_SCOPED_TABLES: string[] = db.tables
  .filter((t) => t.schema.indexes.some((idx) => idx.name === "projectId"))
  .map((t) => t.name)
  .filter((name) => !PROJECT_SCOPED_NOT_CASCADED.has(name));

export async function createProject(
  data: Pick<Project, "title"> &
    Partial<
      Pick<
        Project,
        "description" | "genre" | "targetWordCount" | "mode" | "coverImageUrl"
      >
    >,
): Promise<Project> {
  const project = ProjectSchema.parse({
    id: generateId(),
    title: data.title,
    description: data.description ?? "",
    genre: data.genre ?? "",
    targetWordCount: data.targetWordCount ?? 0,
    mode: data.mode ?? "prose",
    coverImageUrl: data.coverImageUrl ?? "",
    createdAt: now(),
    updatedAt: now(),
  });
  await db.projects.add(project);
  return project;
}

export async function updateProject(
  id: ProjectId,
  data: Partial<
    Pick<
      Project,
      "title" | "description" | "genre" | "targetWordCount" | "coverImageUrl"
    >
  >,
): Promise<void> {
  await db.projects.update(id, { ...stripUndefined(data), updatedAt: now() });
}

/** Delete all project-scoped data (but not the project row itself). */
export async function deleteAllProjectData(
  projectId: ProjectId,
): Promise<void> {
  for (const name of PROJECT_SCOPED_TABLES) {
    await db.table(name).where({ projectId }).delete();
  }
}

export async function deleteProject(id: ProjectId): Promise<void> {
  await db.transaction(
    "rw",
    [db.projects, ...PROJECT_SCOPED_TABLES.map((name) => db.table(name))],
    async () => {
      await deleteAllProjectData(id);
      await db.projects.delete(id);
    },
  );
}

export const getProject = createCrud<Project, ProjectId>(db.projects).get;
