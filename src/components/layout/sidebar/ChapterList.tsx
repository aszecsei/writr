"use client";

import { Columns3, FolderOpen } from "lucide-react";
import Link from "next/link";
import type { ProjectId } from "@/db/schemas";
import { useActiveProject } from "@/hooks/data/useProject";
import { getTerm } from "@/lib/terminology";
import { BinderSection } from "./BinderSection";

export function ChapterList({
  projectId,
  pathname,
}: {
  projectId: ProjectId;
  pathname: string;
}) {
  const activeProjectMode = useActiveProject()?.mode ?? null;
  const overviewHref = `/projects/${projectId}`;
  const isOverviewActive = pathname === overviewHref;

  const chapterTerm = getTerm(activeProjectMode, "chapter");
  const addChapter = getTerm(activeProjectMode, "addChapter");

  return (
    <div className="space-y-1">
      <Link
        href={overviewHref}
        className={`flex items-center gap-2 rounded-md px-3 py-density-item text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
          isOverviewActive
            ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
        }`}
      >
        <FolderOpen size={14} />
        Project Overview
      </Link>

      <Link
        href={`/projects/${projectId}/outline`}
        className={`flex items-center gap-2 rounded-md px-3 py-density-item text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
          pathname.startsWith(`/projects/${projectId}/outline`)
            ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
        }`}
      >
        <Columns3 size={14} />
        Outline
      </Link>

      <BinderSection
        projectId={projectId}
        pathname={pathname}
        section="manuscript"
        labels={{
          header: getTerm(activeProjectMode, "chapters"),
          add: addChapter,
          addNested: `Add Nested ${chapterTerm}`,
          untitled: getTerm(activeProjectMode, "untitledChapter"),
          moveToOther: "Move to Scratchpad",
        }}
      />

      <BinderSection
        projectId={projectId}
        pathname={pathname}
        section="scratchpad"
        labels={{
          header: "Scratchpad",
          add: "Add Document",
          addNested: "Add Nested Document",
          untitled: "Untitled Document",
          moveToOther: "Move to Manuscript",
        }}
      />
    </div>
  );
}
