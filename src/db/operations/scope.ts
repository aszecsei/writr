import type { ProjectId } from "../schemas";

/**
 * Scope predicates shared by entries that support the global-vs-project pattern
 * with per-project disable (style guide entries, guardrails). An entry with
 * `projectId === null` is global (applies to every project); otherwise it is
 * scoped to that project. `disabledProjectIds` lists the projects in which the
 * entry is deactivated.
 */
export interface ScopedEntry {
  projectId: ProjectId | null;
  disabledProjectIds?: ProjectId[];
}

/** True if the entry is in scope for `projectId` (global or that project). */
export function appliesToProject(
  entry: ScopedEntry,
  projectId: ProjectId | null,
): boolean {
  return (
    entry.projectId === null ||
    (projectId !== null && entry.projectId === projectId)
  );
}

/** True if the entry has been disabled for `projectId`. */
export function isDisabledInProject(
  entry: ScopedEntry,
  projectId: ProjectId | null,
): boolean {
  if (projectId === null) return false;
  return (entry.disabledProjectIds ?? []).includes(projectId);
}

/** True if the entry both applies to `projectId` and is not disabled there. */
export function isActiveInProject(
  entry: ScopedEntry,
  projectId: ProjectId | null,
): boolean {
  return (
    appliesToProject(entry, projectId) && !isDisabledInProject(entry, projectId)
  );
}

/**
 * Sort comparator placing project-scoped entries before globals, each ordered
 * by their `order` field. Globals share a separate order sequence from each
 * project, so they are grouped rather than interleaved by raw order value.
 */
export function byScopeThenOrder(
  a: { projectId: ProjectId | null; order: number },
  b: { projectId: ProjectId | null; order: number },
): number {
  const aGlobal = a.projectId === null ? 1 : 0;
  const bGlobal = b.projectId === null ? 1 : 0;
  if (aGlobal !== bGlobal) return aGlobal - bGlobal;
  return a.order - b.order;
}
