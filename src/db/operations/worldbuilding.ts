import { db } from "../database";
import { type WorldbuildingDoc, WorldbuildingDocSchema } from "../schemas";
import { generateId, now, reorderEntities } from "./helpers";

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
  return reorderEntities(db.worldbuildingDocs, orderedIds);
}
