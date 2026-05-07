"use client";

import { useParams } from "next/navigation";
import { CharactersPageBody } from "@/components/projects/CharactersPageBody";

export default function CharacterListPage() {
  const params = useParams<{ projectId: string }>();
  return (
    <CharactersPageBody
      projectId={params.projectId}
      basePath={`/projects/${params.projectId}`}
      readOnly={false}
    />
  );
}
