"use client";

import { useParams } from "next/navigation";
import { StyleGuidePageBody } from "@/components/projects/StyleGuidePageBody";
import type { ProjectId } from "@/db/schemas";

export default function SharedStyleGuidePage() {
  const params = useParams<{ projectId: ProjectId }>();
  return <StyleGuidePageBody projectId={params.projectId} />;
}
