import { db } from "../database";
import {
  type ProjectId,
  type WorldbuildingDoc,
  type WorldbuildingDocId,
  WorldbuildingDocSchema,
} from "../schemas";
import {
  generateId,
  getNextOrderForProjectScope,
  now,
  reorderEntities,
  stripUndefined,
} from "./helpers";

// ─── Worldbuilding Docs ─────────────────────────────────────────────

export async function getWorldbuildingDocsByProject(
  projectId: ProjectId,
): Promise<WorldbuildingDoc[]> {
  return db.worldbuildingDocs.where({ projectId }).sortBy("order");
}

export async function getWorldbuildingDoc(
  id: WorldbuildingDocId,
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
  const order = await getNextOrderForProjectScope(
    db.worldbuildingDocs,
    data.projectId,
    data.order,
    (r) => (r as { parentDocId: string | null }).parentDocId === parentDocId,
  );
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
  id: WorldbuildingDocId,
  data: Partial<Omit<WorldbuildingDoc, "id" | "projectId" | "createdAt">>,
): Promise<void> {
  // Cycle detection when changing parentDocId
  if (data.parentDocId !== undefined) {
    let cursor: WorldbuildingDocId | null = data.parentDocId;
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
  await db.worldbuildingDocs.update(id, {
    ...stripUndefined(data),
    updatedAt: now(),
  });
}

export async function deleteWorldbuildingDoc(
  id: WorldbuildingDocId,
): Promise<void> {
  const doc = await db.worldbuildingDocs.get(id);
  if (!doc) return;
  const newParent = doc.parentDocId;
  await db.transaction(
    "rw",
    [db.worldbuildingDocs, db.indexedChunks],
    async () => {
      // Re-parent children to deleted doc's parent
      await db.worldbuildingDocs
        .where({ parentDocId: id })
        .modify({ parentDocId: newParent });
      // Prune the deleted doc's indexed vector chunks (children keep theirs).
      await db.indexedChunks.where({ sourceId: id }).delete();
      await db.worldbuildingDocs.delete(id);
    },
  );
}

export async function reorderWorldbuildingDocs(
  orderedIds: WorldbuildingDocId[],
): Promise<void> {
  return reorderEntities(db.worldbuildingDocs, orderedIds);
}
