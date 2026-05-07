"use client";

import { useParams } from "next/navigation";
import { LocationDetailBody } from "@/components/projects/LocationDetailBody";
import type { LocationId, ProjectId } from "@/db/schemas";

export default function SharedLocationDetailPage() {
  const params = useParams<{
    roomUuid: string;
    projectId: ProjectId;
    locationId: LocationId;
  }>();
  return (
    <LocationDetailBody
      projectId={params.projectId}
      locationId={params.locationId}
      basePath={`/shared/${params.roomUuid}/projects/${params.projectId}`}
      readOnly={true}
    />
  );
}
