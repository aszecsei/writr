"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useChapter } from "@/hooks/data/source";
import { useSharedProjectStore } from "@/store/sharedProjectStore";

/**
 * Guest-side follow-along for the host's active chapter switch.
 *
 * - If the guest is currently on the previously-active chapter route,
 *   auto-navigate to the new active chapter.
 * - Otherwise, render a non-blocking banner "Host moved to {chapter}"
 *   with a one-click jump and a dismiss action.
 */
export function HostMovedBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ roomUuid: string; projectId: string }>();
  const activeChapterId = useSharedProjectStore(
    (s) => s.meta?.activeChapterId ?? null,
  );
  const activeChapter = useChapter(activeChapterId);

  const lastSeenRef = useRef<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  useEffect(() => {
    if (activeChapterId === null) {
      lastSeenRef.current = null;
      setPending(null);
      return;
    }
    const previous = lastSeenRef.current;
    lastSeenRef.current = activeChapterId;
    if (previous === null || previous === activeChapterId) return;

    const baseChapterPath = `/shared/${params.roomUuid}/projects/${params.projectId}/chapters/`;
    const onPreviousChapter = pathname === `${baseChapterPath}${previous}`;
    if (onPreviousChapter) {
      router.replace(`${baseChapterPath}${activeChapterId}`);
      setPending(null);
    } else if (dismissedFor !== activeChapterId) {
      setPending(activeChapterId);
    }
  }, [
    activeChapterId,
    pathname,
    params.roomUuid,
    params.projectId,
    router,
    dismissedFor,
  ]);

  if (!pending) return null;
  if (dismissedFor === pending) return null;

  const targetHref = `/shared/${params.roomUuid}/projects/${params.projectId}/chapters/${pending}`;
  const title = activeChapter?.title ?? "another chapter";

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <div className="mx-auto flex max-w-editor items-center justify-between gap-3">
        <span>
          Host is now editing <strong>{title}</strong>.
        </span>
        <div className="flex items-center gap-3">
          <Link
            href={targetHref}
            onClick={() => setPending(null)}
            className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900"
          >
            Jump to chapter
          </Link>
          <button
            type="button"
            onClick={() => setDismissedFor(pending)}
            className="text-xs text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
