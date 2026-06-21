import { db } from "../database";
import {
  type GuardrailEntry,
  type GuardrailEntryId,
  GuardrailEntrySchema,
  type ProjectId,
} from "../schemas";
import { generateId, getNextOrderForProjectScope, now } from "./helpers";
import { appliesToProject, byScopeThenOrder } from "./scope";

// ─── Guardrail Entries ──────────────────────────────────────────────

/** Entries owned by exactly `projectId` (excludes globals). Used by backup. */
export async function getGuardrailsByProject(
  projectId: ProjectId,
): Promise<GuardrailEntry[]> {
  return db.guardrailEntries.where({ projectId }).sortBy("order");
}

/**
 * All guardrails applicable to a project context: globals (projectId=null) plus
 * those scoped to `projectId`. Includes per-project-disabled entries — callers
 * that need the effective active set must filter with `isActiveInProject`.
 */
export async function listGuardrailsForProject(
  projectId: ProjectId | null,
): Promise<GuardrailEntry[]> {
  const all = await db.guardrailEntries.toArray();
  return all
    .filter((e) => appliesToProject(e, projectId))
    .sort(byScopeThenOrder);
}

export async function getGuardrailEntry(
  id: GuardrailEntryId,
): Promise<GuardrailEntry | undefined> {
  return db.guardrailEntries.get(id);
}

export async function createGuardrailEntry(
  data: Partial<Pick<GuardrailEntry, "projectId">> &
    Pick<GuardrailEntry, "label"> &
    Partial<Pick<GuardrailEntry, "flags" | "fix" | "positiveFix" | "order">>,
): Promise<GuardrailEntry> {
  const projectId = data.projectId ?? null;
  const order = await getNextOrderForProjectScope(
    db.guardrailEntries,
    projectId,
    data.order,
  );
  const ts = now();
  const entry = GuardrailEntrySchema.parse({
    id: generateId(),
    projectId,
    label: data.label,
    flags: data.flags ?? [],
    fix: data.fix ?? "",
    positiveFix: data.positiveFix ?? "",
    order,
    disabledProjectIds: [],
    createdAt: ts,
    updatedAt: ts,
  });
  await db.guardrailEntries.add(entry);
  return entry;
}

export async function updateGuardrailEntry(
  id: GuardrailEntryId,
  data: Partial<Omit<GuardrailEntry, "id" | "createdAt">>,
): Promise<void> {
  await db.guardrailEntries.update(id, { ...data, updatedAt: now() });
}

/** Add or remove `projectId` from a guardrail's per-project disable list. */
export async function setGuardrailDisabledInProject(
  id: GuardrailEntryId,
  projectId: ProjectId,
  disabled: boolean,
): Promise<void> {
  const entry = await db.guardrailEntries.get(id);
  if (!entry) return;
  const current = new Set(entry.disabledProjectIds ?? []);
  if (disabled) current.add(projectId);
  else current.delete(projectId);
  await updateGuardrailEntry(id, { disabledProjectIds: [...current] });
}

export async function deleteGuardrailEntry(
  id: GuardrailEntryId,
): Promise<void> {
  await db.guardrailEntries.delete(id);
}
