"use client";

import { useParams } from "next/navigation";
import { LocationsPageBody } from "@/components/projects/LocationsPageBody";

export default function LocationListPage() {
  const params = useParams<{ projectId: string }>();
  return (
    <LocationsPageBody
      projectId={params.projectId}
      basePath={`/projects/${params.projectId}`}
      readOnly={false}
    />
  );
}
