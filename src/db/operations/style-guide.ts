import { db } from "../database";
import { type StyleGuideEntry, StyleGuideEntrySchema } from "../schemas";
import { generateId, getNextOrder, now } from "./helpers";

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
  const order = await getNextOrder(
    db.styleGuideEntries,
    { projectId: data.projectId },
    data.order,
  );
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
