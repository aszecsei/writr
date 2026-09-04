"use client";

import { useParams } from "next/navigation";
import { ChapterEditor } from "@/components/editor/ChapterEditor";
import { Spinner } from "@/components/ui/Spinner";
import type { ChapterId } from "@/db/schemas";
import { useProjectStore } from "@/store/projectStore";

export default function ChapterEditorPage() {
  const params = useParams<{ chapterId: ChapterId }>();
  const activeProjectMode = useProjectStore((s) => s.activeProjectMode);

  // Wait for project mode to be set in the store (via layout useEffect)
  // before mounting the editor — otherwise it initializes with wrong extensions
  if (!activeProjectMode) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return <ChapterEditor chapterId={params.chapterId} />;
}
