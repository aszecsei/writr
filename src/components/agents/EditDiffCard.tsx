"use client";

import { useEffect, useMemo, useState } from "react";
import { InlineDiff } from "@/components/editor/VersionHistoryDialog";
import { BUTTON_CANCEL, BUTTON_PRIMARY } from "@/components/ui/form-styles";
import type { ProposedEdit } from "@/db/schemas";
import { useChapter } from "@/hooks/data/useChapter";
import { applyEditsToContent } from "@/lib/ai/agents/pipeline";

const SEAM_WORDS = 80;

interface EditDiffCardProps {
  edit: ProposedEdit;
  onApprove: () => void;
  onReject: () => void;
  busy?: boolean;
}

interface DiffSlice {
  oldText: string;
  newText: string;
  hasMore: { before: boolean; after: boolean };
}

/**
 * Single-edit review card. Shows a word-level diff (~80 words of seam context
 * on each side) with full-chapter expansion available. Approve/Reject controls
 * are wired to the run dashboard's mutation handlers.
 */
export function EditDiffCard({
  edit,
  onApprove,
  onReject,
  busy,
}: EditDiffCardProps) {
  const chapter = useChapter(edit.chapterId);
  const [showFull, setShowFull] = useState(false);
  const [slice, setSlice] = useState<DiffSlice | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!chapter) return;
    (async () => {
      const computed = await computeDiffSlice(edit, chapter.content, showFull);
      if (!cancelled) setSlice(computed);
    })();
    return () => {
      cancelled = true;
    };
  }, [edit, chapter, showFull]);

  const statusBadge = useMemo(() => {
    const map: Record<string, string> = {
      pending:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
      approved:
        "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
      applied:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
      discarded:
        "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
    };
    return map[edit.status] ?? "";
  }, [edit.status]);

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
            {chapter?.title ?? edit.chapterId.slice(0, 8)} · {edit.kind}
          </div>
          {edit.rationale && (
            <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
              {edit.rationale}
            </p>
          )}
        </div>
        <span
          className={`whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-medium uppercase ${statusBadge}`}
        >
          {edit.status}
        </span>
      </div>

      <div className="mt-3 max-h-[60vh] overflow-y-auto rounded border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-neutral-900/50">
        {slice ? (
          <>
            {slice.hasMore.before && (
              <div className="mb-1 text-xs text-neutral-400">…</div>
            )}
            <InlineDiff oldText={slice.oldText} newText={slice.newText} />
            {slice.hasMore.after && (
              <div className="mt-1 text-xs text-neutral-400">…</div>
            )}
          </>
        ) : (
          <div className="text-xs text-neutral-500">Loading diff…</div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowFull(!showFull)}
          className="text-xs text-neutral-500 underline-offset-2 hover:underline dark:text-neutral-400"
        >
          {showFull ? "Show seam only" : "Show full chapter diff"}
        </button>
        {edit.status === "pending" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onReject}
              disabled={busy}
              className={BUTTON_CANCEL}
            >
              Reject
            </button>
            <button
              type="button"
              onClick={onApprove}
              disabled={busy}
              className={BUTTON_PRIMARY}
            >
              Approve
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Compute oldText / newText for the diff. Uses ~80 words of seam context
 * unless `showFull` is set, in which case the entire chapter pre-/post-edit
 * is diffed. */
async function computeDiffSlice(
  edit: ProposedEdit,
  chapterContent: string,
  showFull: boolean,
): Promise<DiffSlice> {
  const { content: nextFull, applied } = applyEditsToContent(chapterContent, [
    edit,
  ]);
  if (showFull || applied.length === 0) {
    return {
      oldText: chapterContent,
      newText: nextFull,
      hasMore: { before: false, after: false },
    };
  }

  // Locate the edit's range in the OLD content for slicing.
  const range = findEditRangeInOld(edit, chapterContent);
  if (!range) {
    // Fallback: full diff if we can't locate.
    return {
      oldText: chapterContent,
      newText: nextFull,
      hasMore: { before: false, after: false },
    };
  }

  const before = sliceLastWords(
    chapterContent.slice(0, range.from),
    SEAM_WORDS,
  );
  const after = sliceFirstWords(chapterContent.slice(range.to), SEAM_WORDS);
  const oldChunk = chapterContent.slice(range.from, range.to);

  const oldText = before.text + oldChunk + after.text;
  // Reconstruct the new chunk by applying the edit only within the slice.
  const newChunk = edit.newContent;
  const newText = before.text + newChunk + after.text;

  return {
    oldText,
    newText,
    hasMore: {
      before: before.truncated,
      after: after.truncated,
    },
  };
}

function findEditRangeInOld(
  edit: ProposedEdit,
  content: string,
): { from: number; to: number } | null {
  switch (edit.kind) {
    case "full_chapter":
      return { from: 0, to: content.length };
    case "append":
      return { from: content.length, to: content.length };
    case "insert_at": {
      if (
        typeof edit.fromOffset === "number" &&
        edit.fromOffset >= 0 &&
        edit.fromOffset <= content.length
      ) {
        return { from: edit.fromOffset, to: edit.fromOffset };
      }
      if (edit.anchorText) {
        const idx = content.indexOf(edit.anchorText);
        if (idx >= 0) return { from: idx, to: idx };
      }
      return null;
    }
    case "replace": {
      if (!edit.anchorText) return null;
      const combined =
        (edit.prefix ?? "") + edit.anchorText + (edit.suffix ?? "");
      const idx = content.indexOf(combined);
      if (idx < 0) return null;
      const from = idx + (edit.prefix ?? "").length;
      return { from, to: from + edit.anchorText.length };
    }
  }
}

function sliceLastWords(
  text: string,
  n: number,
): { text: string; truncated: boolean } {
  const words = text.split(/(\s+)/);
  let count = 0;
  for (let i = words.length - 1; i >= 0; i--) {
    if (/\s+/.test(words[i])) continue;
    count++;
    if (count >= n) {
      const truncated = i > 0;
      return { text: words.slice(i).join(""), truncated };
    }
  }
  return { text, truncated: false };
}

function sliceFirstWords(
  text: string,
  n: number,
): { text: string; truncated: boolean } {
  const words = text.split(/(\s+)/);
  let count = 0;
  for (let i = 0; i < words.length; i++) {
    if (/\s+/.test(words[i])) continue;
    count++;
    if (count >= n) {
      const truncated = i < words.length - 1;
      return { text: words.slice(0, i + 1).join(""), truncated };
    }
  }
  return { text, truncated: false };
}
