"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BUTTON_CANCEL, BUTTON_PRIMARY } from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import { deleteCustomAgent } from "@/db/operations/customAgents";
import { useCustomAgents } from "@/hooks/data/useCustomAgents";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";

export function CustomAgentsManager() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const openModal = useUiStore((s) => s.openModal);
  const projectId = useProjectStore((s) => s.activeProjectId);
  const agents = useCustomAgents(projectId);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (modal.id !== "custom-agents-manager") return null;

  return (
    <Modal onClose={closeModal} maxWidth="max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Custom Agents
          </h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Saved AI workflows. Selectable from the AI panel's tool dropdown.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openModal({ id: "custom-agent-editor" })}
          className={`${BUTTON_PRIMARY} inline-flex items-center gap-1.5`}
        >
          <Plus size={14} />
          New Agent
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {agents && agents.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No custom agents yet. Click "New Agent" to define one.
          </p>
        )}
        {agents?.map((a) => (
          <div
            key={a.id}
            className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {a.name}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    {a.projectId === null ? "Global" : "Project"}
                  </span>
                </div>
                {a.description && (
                  <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    {a.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {a.allowedToolIds.length} tool
                  {a.allowedToolIds.length === 1 ? "" : "s"}
                  {a.modelOverride
                    ? ` · ${a.modelOverride.provider} (${a.modelOverride.model})`
                    : " · global model"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() =>
                    openModal({
                      id: "custom-agent-editor",
                      agentId: a.id,
                    })
                  }
                  title="Edit"
                  className="rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(a.id)}
                  title="Delete"
                  className="rounded p-1 text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-neutral-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this custom agent?"
          message="This permanently removes the saved configuration. Past chats that referenced it stay intact, but you won't be able to re-run them with the same settings."
          variant="danger"
          confirmLabel="Delete"
          onConfirm={async () => {
            await deleteCustomAgent(confirmDelete);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={closeModal} className={BUTTON_CANCEL}>
          Close
        </button>
      </div>
    </Modal>
  );
}
