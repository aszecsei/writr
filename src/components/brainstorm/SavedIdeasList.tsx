"use client";

import { Check, Copy, FolderPlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { deleteBrainstormIdea } from "@/db/operations";
import type { BrainstormIdea } from "@/db/schemas";
import { useBrainstormIdeas } from "@/hooks/data";

interface SavedIdeasListProps {
  onCreateProject: (ideaText: string) => void;
}

export function SavedIdeasList({ onCreateProject }: SavedIdeasListProps) {
  const ideas = useBrainstormIdeas();
  const [pendingDelete, setPendingDelete] = useState<BrainstormIdea | null>(
    null,
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!ideas || ideas.length === 0) return null;

  async function copy(idea: BrainstormIdea) {
    try {
      await navigator.clipboard.writeText(idea.ideaText);
      setCopiedId(idea.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Ignore clipboard rejection (permissions / insecure context).
    }
  }

  async function handleDelete(idea: BrainstormIdea) {
    await deleteBrainstormIdea(idea.id);
    setPendingDelete(null);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">
        Saved ideas
      </h2>
      <ul className="space-y-3">
        {ideas.map((idea) => (
          <li
            key={idea.id}
            className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700"
          >
            <p className="whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-200">
              {idea.ideaText}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => copy(idea)}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-2.5 py-1 text-xs text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                {copiedId === idea.id ? (
                  <Check size={14} />
                ) : (
                  <Copy size={14} />
                )}
                {copiedId === idea.id ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => onCreateProject(idea.ideaText)}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-2.5 py-1 text-xs text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <FolderPlus size={14} />
                Create project
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(idea)}
                aria-label="Delete idea"
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-2.5 py-1 text-xs text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:border-neutral-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete saved idea"
          message="This permanently removes the saved idea."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => handleDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </section>
  );
}
