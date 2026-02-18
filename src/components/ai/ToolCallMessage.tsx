"use client";

import { AlertCircle, Check, CircleDashed, Loader2, X } from "lucide-react";
import type { ToolCallEntry } from "@/lib/ai/tool-calling";

const MAX_VALUE_LENGTH = 200;

function truncate(value: unknown): string {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  if (str.length <= MAX_VALUE_LENGTH) return str;
  return `${str.slice(0, MAX_VALUE_LENGTH)}...`;
}

function StatusBadge({ status }: { status: ToolCallEntry["status"] }) {
  switch (status) {
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">
          <CircleDashed size={10} />
          Pending
        </span>
      );
    case "approved":
    case "executed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
          <Check size={10} />
          {status === "approved" ? "Approved" : "Executed"}
        </span>
      );
    case "denied":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
          <X size={10} />
          Denied
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
          <AlertCircle size={10} />
          Error
        </span>
      );
  }
}

interface ToolCallMessageProps {
  entry: ToolCallEntry;
  onApprove?: () => void;
  onDeny?: () => void;
  loading?: boolean;
}

export function ToolCallMessage({
  entry,
  onApprove,
  onDeny,
  loading,
}: ToolCallMessageProps) {
  const paramEntries = Object.entries(entry.input).filter(
    ([key]) => key !== "id",
  );

  return (
    <div className="my-2 rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-1.5 dark:border-neutral-700">
        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
          {entry.displayName}
        </span>
        <StatusBadge status={entry.status} />
        {loading && (
          <Loader2 size={12} className="animate-spin text-neutral-400" />
        )}
      </div>

      {/* Parameters */}
      {paramEntries.length > 0 && (
        <div className="px-3 py-1.5 space-y-0.5">
          {paramEntries.map(([key, value]) => (
            <div key={key} className="flex gap-2 text-xs">
              <span className="shrink-0 font-medium text-neutral-500 dark:text-neutral-400">
                {key}:
              </span>
              <span className="text-neutral-700 dark:text-neutral-300 break-all">
                {truncate(value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Approval buttons */}
      {entry.status === "pending" && onApprove && onDeny && (
        <div className="flex gap-2 border-t border-neutral-200 px-3 py-1.5 dark:border-neutral-700">
          <button
            type="button"
            onClick={onApprove}
            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
          >
            <Check size={12} />
            Approve
          </button>
          <button
            type="button"
            onClick={onDeny}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-700"
          >
            <X size={12} />
            Deny
          </button>
        </div>
      )}

      {/* Result */}
      {entry.result && (
        <div
          className={`border-t px-3 py-1.5 text-xs ${
            entry.result.success
              ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
          }`}
        >
          {entry.result.message}
        </div>
      )}
    </div>
  );
}
