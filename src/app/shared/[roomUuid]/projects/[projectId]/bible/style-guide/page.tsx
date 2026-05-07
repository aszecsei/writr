"use client";

import { useParams } from "next/navigation";
import { StyleGuidePageBody } from "@/components/projects/StyleGuidePageBody";

export default function SharedStyleGuidePage() {
  const params = useParams<{ projectId: string }>();
  return <StyleGuidePageBody projectId={params.projectId} readOnly={true} />;
}
