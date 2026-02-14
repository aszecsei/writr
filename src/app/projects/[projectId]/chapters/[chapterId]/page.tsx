"use client";

import { useParams } from "next/navigation";
import { ChapterEditor } from "@/components/editor/ChapterEditor";
import { useProjectStore } from "@/store/projectStore";

export default function ChapterEditorPage() {
  const params = useParams<{ chapterId: string }>();
  const activeProjectMode = useProjectStore((s) => s.activeProjectMode);

  // Wait for project mode to be set in the store (via layout useEffect)
  // before mounting the editor — otherwise it initializes with wrong extensions
  if (!activeProjectMode) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-600 dark:border-neutral-700 dark:border-t-primary-400" />
      </div>
    );
  }

  return <ChapterEditor chapterId={params.chapterId} />;
}
