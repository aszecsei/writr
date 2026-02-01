"use client";

import { useParams } from "next/navigation";
import { ChapterEditor } from "@/components/editor/ChapterEditor";

export default function ChapterEditorPage() {
  const params = useParams<{ chapterId: string }>();
  return <ChapterEditor chapterId={params.chapterId} />;
}
