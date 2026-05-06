"use client";

import { useParams } from "next/navigation";
import { CharacterDetailBody } from "@/components/projects/CharacterDetailBody";

export default function CharacterDetailPage() {
  const params = useParams<{ projectId: string; characterId: string }>();
  return (
    <CharacterDetailBody
      projectId={params.projectId}
      characterId={params.characterId}
      basePath={`/projects/${params.projectId}`}
      readOnly={false}
    />
  );
}
