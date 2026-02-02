"use client";

import { Modal } from "@/components/ui/Modal";
import type { AiMessage } from "@/lib/ai/types";

interface PromptInspectorModalProps {
  promptMessages: AiMessage[];
  onClose: () => void;
}

export function PromptInspectorModal({
  promptMessages,
  onClose,
}: PromptInspectorModalProps) {
  const roleColors: Record<string, string> = {
    system:
      "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    user: "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
    assistant: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <div className="flex flex-col max-h-[85vh]">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Prompt Inspector
        </h2>
        <div className="flex-1 overflow-y-auto space-y-4">
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
    </Modal>
  );
}
