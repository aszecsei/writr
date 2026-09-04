"use client";

import { useParams } from "next/navigation";
import { CharactersPageBody } from "@/components/projects/CharactersPageBody";
import type { ProjectId } from "@/db/schemas";

export default function SharedCharactersPage() {
  const params = useParams<{ projectId: ProjectId }>();
  return <CharactersPageBody projectId={params.projectId} />;
}
