"use client";

import { useParams } from "next/navigation";
import { ChapterEditor } from "@/components/editor/ChapterEditor";
import { Spinner } from "@/components/ui/Spinner";
import type { ChapterId } from "@/db/schemas";
import { useActiveProject } from "@/hooks/data/useProject";

export default function ChapterEditorPage() {
  const params = useParams<{ chapterId: ChapterId }>();
  const activeProject = useActiveProject();

  // Wait for the active project to load before mounting the editor —
  // otherwise it initializes with wrong extensions
  if (!activeProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return <ChapterEditor chapterId={params.chapterId} />;
}
