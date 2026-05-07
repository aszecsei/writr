"use client";

import { useParams } from "next/navigation";
import { TimelinePageBody } from "@/components/projects/TimelinePageBody";

export default function SharedTimelinePage() {
  const params = useParams<{ projectId: string }>();
  return <TimelinePageBody projectId={params.projectId} readOnly={true} />;
}
