"use client";

import { useParams } from "next/navigation";
import { LocationDetailBody } from "@/components/projects/LocationDetailBody";

export default function SharedLocationDetailPage() {
  const params = useParams<{
    roomUuid: string;
    projectId: string;
    locationId: string;
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
