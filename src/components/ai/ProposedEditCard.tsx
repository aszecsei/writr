"use client";

import { diffWordsWithSpace } from "diff";
import { AlertTriangle, Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import type { ChapterId } from "@/db/schemas";
import { useEditorStore } from "@/store/editorStore";

/**
 * Shape returned by the propose_edit tool. Mirrors the `data` payload built
 * in tools/proposedEdits.ts.
 */
export interface ProposedEditChatPayload {
  chapterId: ChapterId;
  chapterTitle: string;
  kind: "replace" | "insert_at" | "append" | "full_chapter";
  anchorText?: string;
  /** `replace` only — verbatim disambiguation context preceding anchorText. */
  prefix?: string;
  /** `replace` only — verbatim disambiguation context following anchorText. */
  suffix?: string;
  newContent: string;
  rationale?: string;
  originalText: string;
  anchorFound: boolean;
}

const KIND_LABEL: Record<ProposedEditChatPayload["kind"], string> = {
  replace: "Replace",
  insert_at: "Insert",
  append: "Append",
  full_chapter: "Rewrite chapter",
};

interface Props {
  payload: ProposedEditChatPayload;
}

type CardStatus = "pending" | "applying" | "applied" | "discarded" | "failed";

export function ProposedEditCard({ payload }: Props) {
  const requestStagedEdit = useEditorStore((s) => s.requestStagedEdit);
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const activeDocumentType = useEditorStore((s) => s.activeDocumentType);
  // Correlation id so the asynchronous apply (run in ChapterEditor) can report
  // success/failure back to this specific card. Stable across re-renders.
  const editId = useId();
  const stagedResult = useEditorStore((s) => s.stagedEditResults[editId]);
  const clearStagedEditResult = useEditorStore((s) => s.clearStagedEditResult);
  const [status, setStatus] = useState<CardStatus>("pending");
  // Default-collapsed for full_chapter so the transcript doesn't drown in a
  // wall of prose. Granular kinds expand by default.
  const [expanded, setExpanded] = useState(payload.kind !== "full_chapter");

  // The consumer locates the anchor against the live document at apply time;
  // resolve the reported outcome into the card's status, then clear it.
  useEffect(() => {
    if (!stagedResult) return;
    setStatus(stagedResult === "applied" ? "applied" : "failed");
    clearStagedEditResult(editId);
  }, [stagedResult, editId, clearStagedEditResult]);

  const chapterMatches =
    activeDocumentType === "chapter" && activeDocumentId === payload.chapterId;
  // Allow apply from the initial pending state and after a failed attempt
  // (Retry) — both require the anchor to be present and the chapter active.
  const canApply =
    (status === "pending" || status === "failed") &&
    payload.anchorFound &&
    chapterMatches;

  const disabledReason = useMemo(() => {
    if (status !== "pending" && status !== "failed") return null;
    if (!payload.anchorFound) return "Anchor text not found in chapter.";
    if (!chapterMatches)
      return "Switch back to this chapter to apply this edit.";
    return null;
  }, [status, payload.anchorFound, chapterMatches]);

  function handleApply() {
    setStatus("applying");
    requestStagedEdit({
      editId,
      chapterId: payload.chapterId,
      kind: payload.kind,
      anchorText: payload.anchorText,
      prefix: payload.prefix,
      suffix: payload.suffix,
      newContent: payload.newContent,
    });
  }

  function handleDiscard() {
    setStatus("discarded");
  }

  return (
    <div className="my-2 rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-1.5 dark:border-neutral-700">
        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
          Propose Edit
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-medium text-primary-700 dark:bg-primary-900 dark:text-primary-300">
          {KIND_LABEL[payload.kind]}
        </span>
        <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">
          {payload.chapterTitle}
        </span>
        <StatusChip status={status} />
        {payload.kind === "full_chapter" && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto inline-flex items-center gap-0.5 rounded p-0.5 text-xs text-neutral-500 transition-colors hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
            title={expanded ? "Collapse diff" : "Expand diff"}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {expanded ? (
        <div className="px-3 py-2">
          <DiffBody
            original={payload.originalText}
            replacement={payload.newContent}
            kind={payload.kind}
          />
        </div>
      ) : (
        <div className="px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400">
          Replace whole chapter (~
          {countWords(payload.newContent)} words). Click to expand.
        </div>
      )}

      {payload.rationale && (
        <div className="border-t border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
          <span className="font-medium">Why:</span> {payload.rationale}
        </div>
      )}

      {disabledReason && (
        <div className="flex items-start gap-1.5 border-t border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{disabledReason}</span>
        </div>
      )}

      {status === "failed" && !disabledReason && (
        <div className="flex items-start gap-1.5 border-t border-red-200 bg-red-50 px-3 py-1.5 text-[11px] text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>
            Couldn't apply this edit — the chapter changed since it was
            proposed. Adjust the chapter to match, then retry.
          </span>
        </div>
      )}

      {(status === "pending" ||
        status === "applying" ||
        status === "failed") && (
        <div className="flex gap-2 border-t border-neutral-200 px-3 py-1.5 dark:border-neutral-700">
          <button
            type="button"
            onClick={handleApply}
            disabled={status === "applying" || !canApply}
            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-700 dark:hover:bg-green-600"
          >
            <Check size={12} />
            {status === "applying"
              ? "Applying…"
              : status === "failed"
                ? "Retry"
                : "Apply"}
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={status === "applying"}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-700"
          >
            <X size={12} />
            Discard
          </button>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: CardStatus }) {
  if (status === "pending" || status === "applying") return null;
  if (status === "applied") {
    return (
      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
        <Check size={10} />
        Applied
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
        <AlertTriangle size={10} />
        Failed
      </span>
    );
  }
  return (
    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
      <X size={10} />
      Discarded
    </span>
  );
}

interface DiffBodyProps {
  original: string;
  replacement: string;
  kind: ProposedEditChatPayload["kind"];
}

function DiffBody({ original, replacement, kind }: DiffBodyProps) {
  const isPureInsertion = kind === "append" || kind === "insert_at";
  // Pure-insertion kinds have no "before" — short-circuit the diff and just
  // render the new content with the added styling. Memoize unconditionally so
  // hook order is stable.
  const parts = useMemo(
    () => (isPureInsertion ? null : diffWordsWithSpace(original, replacement)),
    [isPureInsertion, original, replacement],
  );

  if (isPureInsertion || !parts) {
    return (
      <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-snug text-green-700 dark:text-green-400">
        {replacement}
      </pre>
    );
  }

  // Build stable keys: tag + cumulative position + value-prefix. The full
  // value would be unique enough but for a long unchanged paragraph it would
  // make the key huge — the position prefix makes adjacent identical words
  // distinguishable cheaply.
  let cursor = 0;
  const keyed = parts.map((part) => {
    const tag = part.added ? "a" : part.removed ? "r" : "u";
    const key = `${tag}@${cursor}:${part.value.slice(0, 8)}`;
    cursor += part.value.length;
    return { key, part };
  });

  return (
    <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-snug text-neutral-700 dark:text-neutral-300">
      {keyed.map(({ key, part }) => {
        if (part.added) {
          return (
            <span
              key={key}
              className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
            >
              {part.value}
            </span>
          );
        }
        if (part.removed) {
          return (
            <span
              key={key}
              className="bg-red-100 text-red-800 line-through dark:bg-red-900/50 dark:text-red-300"
            >
              {part.value}
            </span>
          );
        }
        return <span key={key}>{part.value}</span>;
      })}
    </pre>
  );
}

function countWords(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}
