import { db } from "../database";
import {
  type ProjectId,
  type StyleGuideEntry,
  type StyleGuideEntryId,
  StyleGuideEntrySchema,
} from "../schemas";
import {
  generateId,
  getNextOrderForProjectScope,
  now,
  stripUndefined,
} from "./helpers";
import { appliesToProject, byScopeThenOrder } from "./scope";

// ─── Style Guide Entries ────────────────────────────────────────────

/** Entries owned by exactly `projectId` (excludes globals). Used by backup. */
export async function getStyleGuideByProject(
  projectId: ProjectId,
): Promise<StyleGuideEntry[]> {
  return db.styleGuideEntries.where({ projectId }).sortBy("order");
}

/**
 * All entries applicable to a project context: globals (projectId=null) plus
 * those scoped to `projectId`. Includes per-project-disabled entries — callers
 * that need the effective active set must filter with `isActiveInProject`.
 */
export async function listStyleGuideForProject(
  projectId: ProjectId | null,
): Promise<StyleGuideEntry[]> {
  const all = await db.styleGuideEntries.toArray();
  return all
    .filter((e) => appliesToProject(e, projectId))
    .sort(byScopeThenOrder);
}

export async function getStyleGuideEntry(
  id: StyleGuideEntryId,
): Promise<StyleGuideEntry | undefined> {
  return db.styleGuideEntries.get(id);
}

export async function createStyleGuideEntry(
  data: Partial<Pick<StyleGuideEntry, "projectId">> &
    Pick<StyleGuideEntry, "title"> &
    Partial<Pick<StyleGuideEntry, "category" | "content" | "order">>,
): Promise<StyleGuideEntry> {
  const projectId = data.projectId ?? null;
  const order = await getNextOrderForProjectScope(
    db.styleGuideEntries,
    projectId,
    data.order,
  );
  const ts = now();
  const entry = StyleGuideEntrySchema.parse({
    id: generateId(),
    projectId,
    category: data.category ?? "custom",
    title: data.title,
    content: data.content ?? "",
    order,
    disabledProjectIds: [],
    createdAt: ts,
    updatedAt: ts,
  });
  await db.styleGuideEntries.add(entry);
  return entry;
}

export async function updateStyleGuideEntry(
  id: StyleGuideEntryId,
  data: Partial<Omit<StyleGuideEntry, "id" | "createdAt">>,
): Promise<void> {
  await db.styleGuideEntries.update(id, {
    ...stripUndefined(data),
    updatedAt: now(),
  });
}

/** Add or remove `projectId` from an entry's per-project disable list. */
export async function setStyleGuideDisabledInProject(
  id: StyleGuideEntryId,
  projectId: ProjectId,
  disabled: boolean,
): Promise<void> {
  const entry = await db.styleGuideEntries.get(id);
  if (!entry) return;
  const current = new Set(entry.disabledProjectIds ?? []);
  if (disabled) current.add(projectId);
  else current.delete(projectId);
  await updateStyleGuideEntry(id, { disabledProjectIds: [...current] });
}

export async function deleteStyleGuideEntry(
  id: StyleGuideEntryId,
): Promise<void> {
  await db.styleGuideEntries.delete(id);
}
