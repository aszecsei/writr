"use client";

import { useCallback } from "react";
import type { Chapter, ProjectId } from "@/db/schemas";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import {
  useCharactersByProject,
  useLocationsByProject,
  useWorldbuildingDocsByProject,
} from "@/hooks/data/useBibleEntries";
import { useManuscriptChapters } from "@/hooks/data/useChapter";
import { getEmbeddingProvider } from "@/lib/retrieval/embedding/get-provider";
import { reindexProject } from "@/lib/retrieval/indexer";
import { retrieveContext } from "@/lib/retrieval/retriever";
import type { RetrievalResult } from "@/lib/retrieval/types";

export function useLoreRetrieval(
  projectId: ProjectId | null,
): (currentChapter: Chapter) => Promise<RetrievalResult | null> {
  const settings = useAppSettings();
  const characters = useCharactersByProject(projectId);
  const locations = useLocationsByProject(projectId);
  const worldbuildingDocs = useWorldbuildingDocsByProject(projectId);
  const chapters = useManuscriptChapters(projectId);

  return useCallback(
    async (currentChapter: Chapter) => {
      if (!projectId || !settings?.loreRetrievalEnabled) return null;
      const provider = getEmbeddingProvider();
      const docs = worldbuildingDocs ?? [];
      const chs = chapters ?? [];
      await reindexProject({
        provider,
        projectId,
        worldbuildingDocs: docs,
        chapters: chs,
        skipSourceIds: new Set([currentChapter.id]),
      });
      return retrieveContext({
        provider,
        projectId,
        currentChapter,
        chapters: chs,
        characters: characters ?? [],
        locations: locations ?? [],
        worldbuildingDocs: docs,
        settings: {
          omniscient: settings.omniscientMode,
          loreTopK: settings.loreTopK,
          sceneTopK: settings.sceneTopK,
          similarityFloor: settings.similarityFloor,
        },
      });
    },
    [settings, characters, locations, worldbuildingDocs, chapters, projectId],
  );
}
