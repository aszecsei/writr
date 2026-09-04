"use client";

import { useMemo } from "react";
import { useDataSource } from "@/context/DataSourceContext";
import type {
  Chapter,
  ChapterId,
  Character,
  CharacterId,
  CharacterRelationship,
  Location,
  LocationId,
  Project,
  ProjectId,
} from "@/db/schemas";
import type { ProjectDocTable } from "@/lib/collab/projectDoc";
import { useSharedProjectStore } from "@/store/sharedProjectStore";
import {
  useChapter as dexieUseChapter,
  useChaptersByProject as dexieUseChaptersByProject,
  useCharacter as dexieUseCharacter,
  useCharactersByProject as dexieUseCharactersByProject,
  useGuardrailsByProject as dexieUseGuardrailsByProject,
  useLocation as dexieUseLocation,
  useLocationsByProject as dexieUseLocationsByProject,
  useProject as dexieUseProject,
  useRelationshipsByProject as dexieUseRelationshipsByProject,
  useStyleGuideByProject as dexieUseStyleGuideByProject,
  useTimelineByProject as dexieUseTimelineByProject,
} from "./index";

function useSharedList<T extends { id: string }>(
  table: ProjectDocTable,
  projectId: ProjectId | null,
  sortField?: keyof T & string,
): T[] {
  const map = useSharedProjectStore((s) => s.byTable[table]);
  return useMemo(() => {
    if (!projectId) return [];
    const rows = [...map.values()] as unknown as T[];
    const filtered = rows.filter(
      (r) => (r as unknown as { projectId?: string }).projectId === projectId,
    );
    if (sortField) {
      filtered.sort((a, b) => {
        const av = a[sortField];
        const bv = b[sortField];
        if (av === bv) return 0;
        return (av as number | string) < (bv as number | string) ? -1 : 1;
      });
    }
    return filtered;
  }, [map, projectId, sortField]);
}

function useSharedEntity<T extends { id: string }>(
  table: ProjectDocTable,
  id: T["id"] | null,
): T | undefined {
  const map = useSharedProjectStore((s) => s.byTable[table]);
  return useMemo(() => {
    if (!id) return undefined;
    return map.get(id) as T | undefined;
  }, [map, id]);
}

/** Reads a single entity by id, from Dexie or the shared project store. */
function useSourcedEntity<T extends { id: string }>(
  dexieHook: (id: T["id"] | null) => T | undefined,
  table: ProjectDocTable,
  id: T["id"] | null,
): T | undefined {
  const source = useDataSource();
  const dexie = dexieHook(source.kind === "dexie" ? id : null);
  const shared = useSharedEntity<T>(table, id);
  return source.kind === "dexie" ? dexie : shared;
}

/** Reads a project-scoped list, from Dexie or the shared project store. */
function useSourcedList<T extends { id: string }>(
  dexieHook: (projectId: ProjectId | null) => T[] | undefined,
  table: ProjectDocTable,
  projectId: ProjectId | null,
  sortField?: keyof T & string,
): T[] | undefined {
  const source = useDataSource();
  const dexie = dexieHook(source.kind === "dexie" ? projectId : null);
  const shared = useSharedList<T>(table, projectId, sortField);
  return source.kind === "dexie" ? dexie : shared;
}

export function useChapter(id: ChapterId | null): Chapter | undefined {
  return useSourcedEntity(dexieUseChapter, "chapters", id);
}

export function useChaptersByProject(projectId: ProjectId | null) {
  return useSourcedList(
    dexieUseChaptersByProject,
    "chapters",
    projectId,
    "order",
  );
}

export function useProject(projectId: ProjectId | null): Project | undefined {
  const source = useDataSource();
  const dexie = dexieUseProject(source.kind === "dexie" ? projectId : null);
  const shared = useSharedProjectStore((s) =>
    projectId && s.project?.id === projectId ? s.project : null,
  );
  return source.kind === "dexie" ? dexie : (shared ?? undefined);
}

export function useCharacter(id: CharacterId | null): Character | undefined {
  return useSourcedEntity(dexieUseCharacter, "characters", id);
}

export function useCharactersByProject(projectId: ProjectId | null) {
  return useSourcedList(
    dexieUseCharactersByProject,
    "characters",
    projectId,
    "name",
  );
}

export function useLocation(id: LocationId | null): Location | undefined {
  return useSourcedEntity(dexieUseLocation, "locations", id);
}

export function useLocationsByProject(projectId: ProjectId | null) {
  return useSourcedList(
    dexieUseLocationsByProject,
    "locations",
    projectId,
    "name",
  );
}

export function useTimelineByProject(projectId: ProjectId | null) {
  return useSourcedList(
    dexieUseTimelineByProject,
    "timeline",
    projectId,
    "order",
  );
}

export function useStyleGuideByProject(projectId: ProjectId | null) {
  return useSourcedList(
    dexieUseStyleGuideByProject,
    "styleGuide",
    projectId,
    "order",
  );
}

export function useGuardrailsByProject(projectId: ProjectId | null) {
  return useSourcedList(
    dexieUseGuardrailsByProject,
    "guardrails",
    projectId,
    "order",
  );
}

export function useRelationshipsByProject(projectId: ProjectId | null) {
  return useSourcedList<CharacterRelationship>(
    dexieUseRelationshipsByProject,
    "characterRels",
    projectId,
  );
}
