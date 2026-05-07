"use client";

import { useParams } from "next/navigation";
import { CharactersPageBody } from "@/components/projects/CharactersPageBody";
import type { ProjectId } from "@/db/schemas";

export default function CharacterListPage() {
  const params = useParams<{ projectId: ProjectId }>();
  return (
    <CharactersPageBody
      projectId={params.projectId}
      basePath={`/projects/${params.projectId}`}
      readOnly={false}
    />
  );
}
