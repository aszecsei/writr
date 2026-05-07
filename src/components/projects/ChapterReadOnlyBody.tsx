"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ChapterId, ProjectId } from "@/db/schemas";
import { useChapter, useChaptersByProject } from "@/hooks/data/source";
import { useSharedProjectStore } from "@/store/sharedProjectStore";

export interface ChapterReadOnlyBodyProps {
  projectId: ProjectId;
  chapterId: ChapterId;
  basePath: string;
}

/**
 * Read-only chapter view for project-share guests. Renders the chapter
 * content from the synced snapshot. The host's project mirror keeps the
 * snapshot fresh as Dexie auto-save fires, so edit-role guests viewing
 * the active chapter see updates land within debounce + diff time.
 *
 * A subsequent iteration will branch here on chapterId === active
 * chapter to bind the live prose Y.Doc instead of the snapshot, so
 * keystroke-rate updates are visible to edit/review guests.
 */
export function ChapterReadOnlyBody({
  projectId,
  chapterId,
  basePath,
}: ChapterReadOnlyBodyProps) {
  const chapter = useChapter(chapterId);
  const chapters = useChaptersByProject(projectId);
  const meta = useSharedProjectStore((s) => s.meta);

  if (chapter === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-600 dark:border-neutral-700 dark:border-t-primary-400" />
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="mx-auto max-w-editor px-8 py-8">
        <Link
          href={basePath}
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          <ChevronLeft size={16} /> Back to project
        </Link>
        <p className="mt-6 text-sm text-neutral-500">
          Chapter not found in the synced project.
        </p>
      </div>
    );
  }

  const isActive = meta?.activeChapterId === chapter.id;
  const ordered = (chapters ?? []).map((c) => c.id);
  const indexOf = ordered.indexOf(chapter.id);
  const prevId = indexOf > 0 ? ordered[indexOf - 1] : null;
  const nextId =
    indexOf >= 0 && indexOf < ordered.length - 1 ? ordered[indexOf + 1] : null;

  return (
    <div className="mx-auto max-w-editor px-8 py-8">
      <div className="flex items-center justify-between">
        <Link
          href={basePath}
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          <ChevronLeft size={16} /> Project
        </Link>
        {isActive && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            Host is editing
          </span>
        )}
      </div>
      <h2 className="mt-4 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
        {chapter.title}
      </h2>
      {chapter.synopsis && (
        <p className="mt-2 text-sm italic text-neutral-500 dark:text-neutral-400">
          {chapter.synopsis}
        </p>
      )}
      <article className="prose prose-sm mt-6 max-w-none whitespace-pre-wrap text-neutral-800 dark:prose-invert dark:text-neutral-200">
        {chapter.content || <p className="text-neutral-400">(empty)</p>}
      </article>
      <nav className="mt-10 flex items-center justify-between border-t border-neutral-200 pt-4 text-sm dark:border-neutral-800">
        {prevId ? (
          <Link
            href={`${basePath}/chapters/${prevId}`}
            className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        {nextId ? (
          <Link
            href={`${basePath}/chapters/${nextId}`}
            className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            Next →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
