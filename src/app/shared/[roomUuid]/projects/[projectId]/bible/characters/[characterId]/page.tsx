"use client";

import { useParams } from "next/navigation";
import { CharacterDetailBody } from "@/components/projects/CharacterDetailBody";

export default function SharedCharacterDetailPage() {
  const params = useParams<{
    roomUuid: string;
    projectId: string;
    characterId: string;
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
