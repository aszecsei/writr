"use client";

import { useMemo } from "react";
import { useDataSource } from "@/context/DataSourceContext";
import type {
  Chapter,
  ChapterId,
  Character,
  CharacterId,
  CharacterRelationship,
  GuardrailEntry,
  GuardrailEntryId,
  Location,
  LocationId,
  OutlineGridCell,
  OutlineGridColumn,
  OutlineGridRow,
  Project,
  ProjectId,
  StyleGuideEntry,
  StyleGuideEntryId,
  TimelineEvent,
  TimelineEventId,
  WorldbuildingDoc,
  WorldbuildingDocId,
} from "@/db/schemas";
import type { ProjectDocTable } from "@/lib/collab/projectDoc";
import { useSharedProjectStore } from "@/store/sharedProjectStore";
import {
  useChapter as dexieUseChapter,
  useChaptersByProject as dexieUseChaptersByProject,
  useCharacter as dexieUseCharacter,
  useCharactersByProject as dexieUseCharactersByProject,
  useGuardrailEntry as dexieUseGuardrailEntry,
  useGuardrailsByProject as dexieUseGuardrailsByProject,
  useLocation as dexieUseLocation,
  useLocationsByProject as dexieUseLocationsByProject,
  useProject as dexieUseProject,
  useRelationshipsByProject as dexieUseRelationshipsByProject,
  useStyleGuideByProject as dexieUseStyleGuideByProject,
  useStyleGuideEntry as dexieUseStyleGuideEntry,
  useTimelineByProject as dexieUseTimelineByProject,
  useTimelineEvent as dexieUseTimelineEvent,
  useWorldbuildingDoc as dexieUseWorldbuildingDoc,
  useWorldbuildingDocsByProject as dexieUseWorldbuildingDocsByProject,
} from "./index";

type SortFieldName = string;

function useSharedList<T extends { id: string }>(
  table: ProjectDocTable,
  projectId: ProjectId | null,
  sortField?: SortFieldName,
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
        const av = (a as unknown as Record<string, unknown>)[sortField];
        const bv = (b as unknown as Record<string, unknown>)[sortField];
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

export function useChapter(id: ChapterId | null): Chapter | undefined {
  const source = useDataSource();
  const dexie = dexieUseChapter(source.kind === "dexie" ? id : null);
  const shared = useSharedEntity<Chapter>("chapters", id);
  return source.kind === "dexie" ? dexie : shared;
}

export function useChaptersByProject(projectId: ProjectId | null) {
  const source = useDataSource();
  const dexie = dexieUseChaptersByProject(
    source.kind === "dexie" ? projectId : null,
  );
  const shared = useSharedList<Chapter>("chapters", projectId, "order");
  return source.kind === "dexie" ? dexie : shared;
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
  const source = useDataSource();
  const dexie = dexieUseCharacter(source.kind === "dexie" ? id : null);
  const shared = useSharedEntity<Character>("characters", id);
  return source.kind === "dexie" ? dexie : shared;
}

export function useCharactersByProject(projectId: ProjectId | null) {
  const source = useDataSource();
  const dexie = dexieUseCharactersByProject(
    source.kind === "dexie" ? projectId : null,
  );
  const shared = useSharedList<Character>("characters", projectId, "name");
  return source.kind === "dexie" ? dexie : shared;
}

export function useLocation(id: LocationId | null): Location | undefined {
  const source = useDataSource();
  const dexie = dexieUseLocation(source.kind === "dexie" ? id : null);
  const shared = useSharedEntity<Location>("locations", id);
  return source.kind === "dexie" ? dexie : shared;
}

export function useLocationsByProject(projectId: ProjectId | null) {
  const source = useDataSource();
  const dexie = dexieUseLocationsByProject(
    source.kind === "dexie" ? projectId : null,
  );
  const shared = useSharedList<Location>("locations", projectId, "name");
  return source.kind === "dexie" ? dexie : shared;
}

function useTimelineEvent(
  id: TimelineEventId | null,
): TimelineEvent | undefined {
  const source = useDataSource();
  const dexie = dexieUseTimelineEvent(source.kind === "dexie" ? id : null);
  const shared = useSharedEntity<TimelineEvent>("timeline", id);
  return source.kind === "dexie" ? dexie : shared;
}

export function useTimelineByProject(projectId: ProjectId | null) {
  const source = useDataSource();
  const dexie = dexieUseTimelineByProject(
    source.kind === "dexie" ? projectId : null,
  );
  const shared = useSharedList<TimelineEvent>("timeline", projectId, "order");
  return source.kind === "dexie" ? dexie : shared;
}

function useStyleGuideEntry(
  id: StyleGuideEntryId | null,
): StyleGuideEntry | undefined {
  const source = useDataSource();
  const dexie = dexieUseStyleGuideEntry(source.kind === "dexie" ? id : null);
  const shared = useSharedEntity<StyleGuideEntry>("styleGuide", id);
  return source.kind === "dexie" ? dexie : shared;
}

export function useStyleGuideByProject(projectId: ProjectId | null) {
  const source = useDataSource();
  const dexie = dexieUseStyleGuideByProject(
    source.kind === "dexie" ? projectId : null,
  );
  const shared = useSharedList<StyleGuideEntry>(
    "styleGuide",
    projectId,
    "order",
  );
  return source.kind === "dexie" ? dexie : shared;
}

function useGuardrailEntry(
  id: GuardrailEntryId | null,
): GuardrailEntry | undefined {
  const source = useDataSource();
  const dexie = dexieUseGuardrailEntry(source.kind === "dexie" ? id : null);
  const shared = useSharedEntity<GuardrailEntry>("guardrails", id);
  return source.kind === "dexie" ? dexie : shared;
}

export function useGuardrailsByProject(projectId: ProjectId | null) {
  const source = useDataSource();
  const dexie = dexieUseGuardrailsByProject(
    source.kind === "dexie" ? projectId : null,
  );
  const shared = useSharedList<GuardrailEntry>(
    "guardrails",
    projectId,
    "order",
  );
  return source.kind === "dexie" ? dexie : shared;
}

function useWorldbuildingDoc(
  id: WorldbuildingDocId | null,
): WorldbuildingDoc | undefined {
  const source = useDataSource();
  const dexie = dexieUseWorldbuildingDoc(source.kind === "dexie" ? id : null);
  const shared = useSharedEntity<WorldbuildingDoc>("worldbuilding", id);
  return source.kind === "dexie" ? dexie : shared;
}

function useWorldbuildingDocsByProject(projectId: ProjectId | null) {
  const source = useDataSource();
  const dexie = dexieUseWorldbuildingDocsByProject(
    source.kind === "dexie" ? projectId : null,
  );
  const shared = useSharedList<WorldbuildingDoc>(
    "worldbuilding",
    projectId,
    "order",
  );
  return source.kind === "dexie" ? dexie : shared;
}

export function useRelationshipsByProject(projectId: ProjectId | null) {
  const source = useDataSource();
  const dexie = dexieUseRelationshipsByProject(
    source.kind === "dexie" ? projectId : null,
  );
  const shared = useSharedList<CharacterRelationship>(
    "characterRels",
    projectId,
  );
  return source.kind === "dexie" ? dexie : shared;
}

// Outline grid hooks live in src/hooks/outline/useOutlineGrid.ts. The
// source-aware wrappers below branch in the same way as the bible/chapter
// hooks above.
import {
  useOutlineGridCells as dexieUseOutlineGridCells,
  useOutlineGridColumns as dexieUseOutlineGridColumns,
  useOutlineGridRows as dexieUseOutlineGridRows,
} from "@/hooks/outline/useOutlineGrid";

function useOutlineGridColumns(projectId: ProjectId | null) {
  const source = useDataSource();
  const dexie = dexieUseOutlineGridColumns(
    source.kind === "dexie" ? projectId : null,
  );
  const shared = useSharedList<OutlineGridColumn>(
    "outlineColumns",
    projectId,
    "order",
  );
  return source.kind === "dexie" ? dexie : shared;
}

function useOutlineGridRows(projectId: ProjectId | null) {
  const source = useDataSource();
  const dexie = dexieUseOutlineGridRows(
    source.kind === "dexie" ? projectId : null,
  );
  const shared = useSharedList<OutlineGridRow>(
    "outlineRows",
    projectId,
    "order",
  );
  return source.kind === "dexie" ? dexie : shared;
}

function useOutlineGridCells(projectId: ProjectId | null) {
  const source = useDataSource();
  const dexie = dexieUseOutlineGridCells(
    source.kind === "dexie" ? projectId : null,
  );
  const shared = useSharedList<OutlineGridCell>("outlineCells", projectId);
  return source.kind === "dexie" ? dexie : shared;
}
