"use client";

import { useParams } from "next/navigation";
import { TimelinePageBody } from "@/components/projects/TimelinePageBody";
import type { ProjectId } from "@/db/schemas";

export default function TimelinePage() {
  const params = useParams<{ projectId: ProjectId }>();
  return <TimelinePageBody projectId={params.projectId} readOnly={false} />;
}
