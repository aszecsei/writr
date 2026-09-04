"use client";

import { useParams } from "next/navigation";
import { CharacterDetailBody } from "@/components/projects/CharacterDetailBody";
import type { CharacterId, ProjectId } from "@/db/schemas";

export default function CharacterDetailPage() {
  const params = useParams<{
    projectId: ProjectId;
    characterId: CharacterId;
  }>();
  return (
    <CharacterDetailBody
      projectId={params.projectId}
      characterId={params.characterId}
    />
  );
}
