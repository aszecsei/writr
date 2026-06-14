"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createBrainstormSetup, deleteBrainstormSetup } from "@/db/operations";
import type { BrainstormSetup, BrainstormSetupId } from "@/db/schemas";

interface SetupListProps {
  setups: BrainstormSetup[];
  selectedId: BrainstormSetupId | null;
  onSelect: (id: BrainstormSetupId | null) => void;
}

export function SetupList({ setups, selectedId, onSelect }: SetupListProps) {
  const [pendingDelete, setPendingDelete] = useState<BrainstormSetup | null>(
    null,
  );

  async function handleCreate() {
    const setup = await createBrainstormSetup({ name: "Untitled setup" });
    onSelect(setup.id);
  }

  async function handleDelete(setup: BrainstormSetup) {
    await deleteBrainstormSetup(setup.id);
    setPendingDelete(null);
    if (selectedId === setup.id) onSelect(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">
          Setups
        </h2>
        <button
          type="button"
          onClick={handleCreate}
          aria-label="New setup"
          className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
        >
          <Plus size={16} />
        </button>
      </div>

      {setups.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No setups yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {setups.map((setup) => (
            <li key={setup.id}>
              <div
                className={`group flex items-center gap-1 rounded-md ${
                  selectedId === setup.id
                    ? "bg-primary-50 dark:bg-primary-900/30"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(setup.id)}
                  className={`flex-1 truncate px-3 py-2 text-left text-sm ${
                    selectedId === setup.id
                      ? "font-medium text-primary-700 dark:text-primary-300"
                      : "text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  {setup.name || "Untitled setup"}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(setup)}
                  aria-label={`Delete ${setup.name}`}
                  className="mr-1 rounded-md p-1.5 text-neutral-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete setup"
          message={`Delete "${pendingDelete.name || "Untitled setup"}"? Saved ideas generated from it are kept.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => handleDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
