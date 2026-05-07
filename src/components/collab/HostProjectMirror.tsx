"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ProjectId } from "@/db/schemas";
import { useChaptersByProject, useProject } from "@/hooks/data";
import {
  useCharactersByProject,
  useLocationsByProject,
  useRelationshipsByProject,
  useStyleGuideByProject,
  useTimelineByProject,
  useWorldbuildingDocsByProject,
} from "@/hooks/data/useBibleEntries";
import {
  useOutlineGridCells,
  useOutlineGridColumns,
  useOutlineGridRows,
} from "@/hooks/outline/useOutlineGrid";
import { ProjectMirror } from "@/lib/collab/projectMirror";
import { collabSelectors, useCollabStore } from "@/store/collabStore";
import { useProjectStore } from "@/store/projectStore";

/**
 * Effect-only host wrapper that mirrors the active project's Dexie state
 * into the project Y.Doc whenever a project-share session is live.
 *
 * Renders nothing. Mounted from `src/app/projects/[projectId]/layout.tsx`.
 */
export function HostProjectMirror({ projectId }: { projectId: ProjectId }) {
  const session = useCollabStore((s) => s.session);
  const isHost = useCollabStore(collabSelectors.isHost);
  const isProjectMode = useCollabStore(collabSelectors.isProjectMode);
  const activeChapterId = useProjectStore((s) => s.activeChapterId);

  const project = useProject(projectId);
  const chapters = useChaptersByProject(projectId);
  const characters = useCharactersByProject(projectId);
  const characterRels = useRelationshipsByProject(projectId);
  const locations = useLocationsByProject(projectId);
  const worldbuilding = useWorldbuildingDocsByProject(projectId);
  const timeline = useTimelineByProject(projectId);
  const styleGuide = useStyleGuideByProject(projectId);
  const outlineColumns = useOutlineGridColumns(projectId);
  const outlineRows = useOutlineGridRows(projectId);
  const outlineCells = useOutlineGridCells(projectId);

  const active = session !== null && isHost && isProjectMode;
  const projectDoc = useMemo(
    () => (active && session ? session.getDoc("project") : null),
    [active, session],
  );

  const mirrorRef = useRef<ProjectMirror | null>(null);
  const seededRef = useRef(false);

  // Construct / destroy the mirror as the session lifecycle changes.
  useEffect(() => {
    if (!projectDoc) return;
    const mirror = new ProjectMirror({ doc: projectDoc, projectId });
    mirrorRef.current = mirror;
    seededRef.current = false;
    return () => {
      mirror.destroy();
      mirrorRef.current = null;
      seededRef.current = false;
    };
  }, [projectDoc, projectId]);

  // Wait for every Dexie hook to deliver its first non-undefined result,
  // then seed the project Y.Doc atomically. Subsequent emissions go
  // through syncTable so only changed rows hit the wire.
  useEffect(() => {
    const mirror = mirrorRef.current;
    if (!mirror) return;
    if (
      project === undefined ||
      chapters === undefined ||
      characters === undefined ||
      characterRels === undefined ||
      locations === undefined ||
      worldbuilding === undefined ||
      timeline === undefined ||
      styleGuide === undefined ||
      outlineColumns === undefined ||
      outlineRows === undefined ||
      outlineCells === undefined
    ) {
      return;
    }
    if (project === null) return;

    if (!seededRef.current) {
      mirror.seedFromSnapshot({
        project,
        activeChapterId: activeChapterId ?? null,
        chapters,
        characters,
        characterRels,
        locations,
        worldbuilding,
        timeline,
        styleGuide,
        outlineColumns,
        outlineRows,
        outlineCells,
      });
      seededRef.current = true;
      return;
    }

    mirror.syncProject(project);
    mirror.syncTable("chapters", chapters);
    mirror.syncTable("characters", characters);
    mirror.syncTable("characterRels", characterRels);
    mirror.syncTable("locations", locations);
    mirror.syncTable("worldbuilding", worldbuilding);
    mirror.syncTable("timeline", timeline);
    mirror.syncTable("styleGuide", styleGuide);
    mirror.syncTable("outlineColumns", outlineColumns);
    mirror.syncTable("outlineRows", outlineRows);
    mirror.syncTable("outlineCells", outlineCells);
  }, [
    project,
    chapters,
    characters,
    characterRels,
    locations,
    worldbuilding,
    timeline,
    styleGuide,
    outlineColumns,
    outlineRows,
    outlineCells,
    activeChapterId,
  ]);

  // Reflect activeChapterId into project meta independently so it lands
  // even if no other entity changed.
  useEffect(() => {
    const mirror = mirrorRef.current;
    if (!mirror || !seededRef.current) return;
    mirror.setActiveChapterId(activeChapterId ?? null);
  }, [activeChapterId]);

  return null;
}
