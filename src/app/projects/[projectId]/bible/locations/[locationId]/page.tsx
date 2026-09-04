"use client";

import { useParams } from "next/navigation";
import { LocationDetailBody } from "@/components/projects/LocationDetailBody";
import type { LocationId, ProjectId } from "@/db/schemas";

export default function LocationDetailPage() {
  const params = useParams<{ projectId: ProjectId; locationId: LocationId }>();
  return (
    <LocationDetailBody
      projectId={params.projectId}
      locationId={params.locationId}
    />
  );
}
