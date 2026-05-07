"use client";

import { useParams } from "next/navigation";
import { ChapterReadOnlyBody } from "@/components/projects/ChapterReadOnlyBody";

export default function SharedChapterPage() {
  const params = useParams<{
    roomUuid: string;
    projectId: string;
    chapterId: string;
  }>();
  return (
    <ChapterReadOnlyBody
      projectId={params.projectId}
      chapterId={params.chapterId}
      basePath={`/shared/${params.roomUuid}/projects/${params.projectId}`}
    />
  );
}
