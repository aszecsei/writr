"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { AiMessage } from "@/lib/ai/types";

interface PromptInspectorModalProps {
  promptMessages: AiMessage[];
  onClose: () => void;
}

export function PromptInspectorModal({
  promptMessages,
  onClose,
}: PromptInspectorModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose();
    }
  }

  const roleColors: Record<string, string> = {
    system:
      "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    user: "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
    assistant: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={handleOverlayClick}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        ref={panelRef}
        className="relative flex w-full max-w-2xl max-h-[85vh] flex-col rounded-xl bg-white shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Prompt Inspector
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {promptMessages.map((msg, i) => (
            <div key={`${msg.role}-${i}`}>
              <span
                className={`inline-block rounded px-2 py-0.5 text-xs font-medium uppercase ${roleColors[msg.role] ?? ""}`}
              >
                {msg.role}
              </span>
              {typeof msg.content === "string" ? (
                <pre className="mt-1.5 whitespace-pre-wrap break-words rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {msg.content}
                </pre>
              ) : (
                msg.content.map((part) => (
                  <div key={part.text.slice(0, 64)} className="mt-1.5">
                    {part.cache_control && (
                      <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-700 dark:bg-amber-900 dark:text-amber-300 mb-1">
                        cached
                      </span>
                    )}
                    <pre className="whitespace-pre-wrap break-words rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                      {part.text}
                    </pre>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
