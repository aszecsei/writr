"use client";

import { useParams } from "next/navigation";
import { LocationDetailBody } from "@/components/projects/LocationDetailBody";

export default function LocationDetailPage() {
  const params = useParams<{ projectId: string; locationId: string }>();
  return (
    <LocationDetailBody
      projectId={params.projectId}
      locationId={params.locationId}
      basePath={`/projects/${params.projectId}`}
      readOnly={false}
    />
  );
}
