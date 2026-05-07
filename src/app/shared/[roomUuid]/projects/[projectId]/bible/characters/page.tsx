"use client";

import { useParams } from "next/navigation";
import { CharactersPageBody } from "@/components/projects/CharactersPageBody";
import type { ProjectId } from "@/db/schemas";

export default function SharedCharactersPage() {
  const params = useParams<{ roomUuid: string; projectId: ProjectId }>();
  return (
    <CharactersPageBody
      projectId={params.projectId}
      basePath={`/shared/${params.roomUuid}/projects/${params.projectId}`}
      readOnly={true}
    />
  );
}
