"use client";

import { useParams } from "next/navigation";
import { ChapterReadOnlyBody } from "@/components/projects/ChapterReadOnlyBody";
import type { ChapterId, ProjectId } from "@/db/schemas";

export default function SharedChapterPage() {
  const params = useParams<{
    projectId: ProjectId;
    chapterId: ChapterId;
  }>();
  return (
    <ChapterReadOnlyBody
      projectId={params.projectId}
      chapterId={params.chapterId}
    />
  );
}
