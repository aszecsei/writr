"use client";

import { useCallback } from "react";
import { isActiveInProject } from "@/db/operations";
import type { ProjectId } from "@/db/schemas";
import {
  useCharactersByProject,
  useGuardrailsByProject,
  useLocationsByProject,
  useRelationshipsByProject,
  useStyleGuideByProject,
  useTimelineByProject,
  useWorldbuildingDocsByProject,
} from "@/hooks/data/useBibleEntries";
import { useManuscriptChapters } from "@/hooks/data/useChapter";
import { useProject } from "@/hooks/data/useProject";
import {
  useOutlineGridCells,
  useOutlineGridColumns,
  useOutlineGridRows,
} from "@/hooks/outline/useOutlineGrid";
import type { AiContext } from "@/lib/ai/types";

/**
 * Build the AiContext from live project data — same shape as the AiPanel.
 * Shared by RunDashboard / PlanView / EditApprovalPanel so all three pass an
 * identical, live-updating context to the agent runner.
 */
export function useAgentRunContext(
  projectId: ProjectId,
): () => Promise<AiContext> {
  const project = useProject(projectId);
  const characters = useCharactersByProject(projectId);
  const locations = useLocationsByProject(projectId);
  const styleGuide = useStyleGuideByProject(projectId);
  const guardrails = useGuardrailsByProject(projectId);
  const timelineEvents = useTimelineByProject(projectId);
  const worldbuildingDocs = useWorldbuildingDocsByProject(projectId);
  const relationships = useRelationshipsByProject(projectId);
  const outlineGridColumns = useOutlineGridColumns(projectId);
  const outlineGridRows = useOutlineGridRows(projectId);
  const outlineGridCells = useOutlineGridCells(projectId);
  const chapters = useManuscriptChapters(projectId);

  return useCallback(
    async () => ({
      projectTitle: project?.title ?? "",
      projectDescription: project?.description ?? "",
      genre: project?.genre ?? "",
      projectMode: project?.mode ?? "prose",
      characters: characters ?? [],
      locations: locations ?? [],
      styleGuide: (styleGuide ?? []).filter((e) =>
        isActiveInProject(e, projectId),
      ),
      guardrails: (guardrails ?? []).filter((e) =>
        isActiveInProject(e, projectId),
      ),
      timelineEvents: timelineEvents ?? [],
      worldbuildingDocs: worldbuildingDocs ?? [],
      relationships: relationships ?? [],
      outlineGridColumns: outlineGridColumns ?? [],
      outlineGridRows: outlineGridRows ?? [],
      outlineGridCells: outlineGridCells ?? [],
      chapters: chapters ?? [],
    }),
    [
      projectId,
      project,
      characters,
      locations,
      styleGuide,
      guardrails,
      timelineEvents,
      worldbuildingDocs,
      relationships,
      outlineGridColumns,
      outlineGridRows,
      outlineGridCells,
      chapters,
    ],
  );
}
