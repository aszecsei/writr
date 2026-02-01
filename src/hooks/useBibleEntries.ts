"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";

export function useCharactersByProject(projectId: string | null) {
  return useLiveQuery(
    () => (projectId ? db.characters.where({ projectId }).sortBy("name") : []),
    [projectId],
  );
}

export function useCharacter(id: string | null) {
  return useLiveQuery(() => (id ? db.characters.get(id) : undefined), [id]);
}

export function useLocationsByProject(projectId: string | null) {
  return useLiveQuery(
    () => (projectId ? db.locations.where({ projectId }).sortBy("name") : []),
    [projectId],
  );
}

export function useLocation(id: string | null) {
  return useLiveQuery(() => (id ? db.locations.get(id) : undefined), [id]);
}

export function useTimelineByProject(projectId: string | null) {
  return useLiveQuery(
    () =>
      projectId ? db.timelineEvents.where({ projectId }).sortBy("order") : [],
    [projectId],
  );
}

export function useTimelineEvent(id: string | null) {
  return useLiveQuery(() => (id ? db.timelineEvents.get(id) : undefined), [id]);
}

export function useStyleGuideByProject(projectId: string | null) {
  return useLiveQuery(
    () =>
      projectId
        ? db.styleGuideEntries.where({ projectId }).sortBy("order")
        : [],
    [projectId],
  );
}

export function useStyleGuideEntry(id: string | null) {
  return useLiveQuery(
    () => (id ? db.styleGuideEntries.get(id) : undefined),
    [id],
  );
}

export function useWorldbuildingDocsByProject(projectId: string | null) {
  return useLiveQuery(
    () =>
      projectId
        ? db.worldbuildingDocs.where({ projectId }).sortBy("title")
        : [],
    [projectId],
  );
}

export function useWorldbuildingDoc(id: string | null) {
  return useLiveQuery(
    () => (id ? db.worldbuildingDocs.get(id) : undefined),
    [id],
  );
}
