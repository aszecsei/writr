"use client";

import { useParams } from "next/navigation";
import { CharacterDetailBody } from "@/components/projects/CharacterDetailBody";
import type { CharacterId, ProjectId } from "@/db/schemas";

export default function SharedCharacterDetailPage() {
  const params = useParams<{
    roomUuid: string;
    projectId: ProjectId;
    characterId: CharacterId;
  }>();
  return (
    <CharacterDetailBody
      projectId={params.projectId}
      characterId={params.characterId}
      basePath={`/shared/${params.roomUuid}/projects/${params.projectId}`}
      readOnly={true}
    />
  );
}
