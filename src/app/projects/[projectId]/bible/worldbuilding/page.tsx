"use client";

import { useParams } from "next/navigation";
import { WorldbuildingTree } from "@/components/worldbuilding/WorldbuildingTree";
import type { ProjectId } from "@/db/schemas";

export default function WorldbuildingListPage() {
  const params = useParams<{ projectId: ProjectId }>();
  return <WorldbuildingTree projectId={params.projectId} />;
}
