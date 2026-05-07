"use client";

import { useParams } from "next/navigation";
import { LocationsPageBody } from "@/components/projects/LocationsPageBody";
import type { ProjectId } from "@/db/schemas";

export default function SharedLocationsPage() {
  const params = useParams<{ roomUuid: string; projectId: ProjectId }>();
  return (
    <LocationsPageBody
      projectId={params.projectId}
      basePath={`/shared/${params.roomUuid}/projects/${params.projectId}`}
      readOnly={true}
    />
  );
}
