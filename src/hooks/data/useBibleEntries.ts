"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import {
  listGuardrailsForProject,
  listStyleGuideForProject,
} from "@/db/operations";
import type { ProjectId } from "@/db/schemas";
import {
  createEntityHook,
  createProjectListHook,
  createProjectListUnsortedHook,
} from "../factories";

export const useCharactersByProject = createProjectListHook(
  db.characters,
  "name",
);
export const useCharacter = createEntityHook(db.characters);

export const useLocationsByProject = createProjectListHook(
  db.locations,
  "name",
);
export const useLocation = createEntityHook(db.locations);

export const useTimelineByProject = createProjectListHook(
  db.timelineEvents,
  "order",
);
export const useTimelineEvent = createEntityHook(db.timelineEvents);

// Style guide & guardrails merge globals (projectId=null) with project-scoped
// entries, so they can't use the exact-projectId factory hook. The merged list
// includes per-project-disabled entries (the editor needs to show them);
// AI-context consumers filter with `isActiveInProject`.
export function useStyleGuideByProject(projectId: ProjectId | null) {
  return useLiveQuery(() => listStyleGuideForProject(projectId), [projectId]);
}
export const useStyleGuideEntry = createEntityHook(db.styleGuideEntries);

export function useGuardrailsByProject(projectId: ProjectId | null) {
  return useLiveQuery(() => listGuardrailsForProject(projectId), [projectId]);
}
export const useGuardrailEntry = createEntityHook(db.guardrailEntries);

export const useWorldbuildingDocsByProject = createProjectListHook(
  db.worldbuildingDocs,
  "order",
);
export const useWorldbuildingDoc = createEntityHook(db.worldbuildingDocs);

export const useRelationshipsByProject = createProjectListUnsortedHook(
  db.characterRelationships,
);
