"use client";

import { useParams } from "next/navigation";
import { LocationsPageBody } from "@/components/projects/LocationsPageBody";
import type { ProjectId } from "@/db/schemas";

export default function LocationListPage() {
  const params = useParams<{ projectId: ProjectId }>();
  return <LocationsPageBody projectId={params.projectId} />;
}
