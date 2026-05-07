"use client";

import { useParams } from "next/navigation";
import { ChapterReadOnlyBody } from "@/components/projects/ChapterReadOnlyBody";
import type { ChapterId, ProjectId } from "@/db/schemas";

export default function SharedChapterPage() {
  const params = useParams<{
    roomUuid: string;
    projectId: ProjectId;
    chapterId: ChapterId;
  }>();
  return (
    <ChapterReadOnlyBody
      projectId={params.projectId}
      chapterId={params.chapterId}
      basePath={`/shared/${params.roomUuid}/projects/${params.projectId}`}
    />
  );
}
