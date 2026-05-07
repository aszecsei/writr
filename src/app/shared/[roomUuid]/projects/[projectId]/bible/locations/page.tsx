"use client";

import { useParams } from "next/navigation";
import { LocationsPageBody } from "@/components/projects/LocationsPageBody";

export default function SharedLocationsPage() {
  const params = useParams<{ roomUuid: string; projectId: string }>();
  return (
    <LocationsPageBody
      projectId={params.projectId}
      basePath={`/shared/${params.roomUuid}/projects/${params.projectId}`}
      readOnly={true}
    />
  );
}
