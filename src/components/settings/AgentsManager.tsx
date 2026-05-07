"use client";

import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BUTTON_CANCEL, BUTTON_PRIMARY } from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import { deleteAgent, resetAgentToDefaults } from "@/db/operations/agents";
import type { AgentDefinition, AgentDefinitionId } from "@/db/schemas";
import { useAllAgents } from "@/hooks/data/useAgents";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";

export function AgentsManager() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const openModal = useUiStore((s) => s.openModal);
  const projectId = useProjectStore((s) => s.activeProjectId);
  const agents = useAllAgents(projectId);
  const [confirmDelete, setConfirmDelete] = useState<AgentDefinitionId | null>(
    null,
  );
  const [confirmReset, setConfirmReset] = useState<AgentDefinitionId | null>(
    null,
  );

  if (modal.id !== "agents-manager") return null;

  return (
    <Modal onClose={closeModal} maxWidth="max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Manage Agents
          </h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Configure the seven built-in agents (system prompt, model override,
            tools) and any agents you've created. Pipeline-internal agents
            (Orchestrator, Verifier) appear here too — they aren't selectable
            from the chat dropdown but inherit model overrides for pipeline
            runs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openModal({ id: "agent-editor" })}
          className={`${BUTTON_PRIMARY} inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap`}
        >
          <Plus size={14} />
          New
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {agents && agents.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Built-in agents will appear here on first launch.
          </p>
        )}
        {agents?.map((a) => (
          <AgentRow
            key={a.id}
            agent={a}
            onEdit={() => openModal({ id: "agent-editor", agentId: a.id })}
            onDelete={() => setConfirmDelete(a.id)}
            onReset={() => setConfirmReset(a.id)}
          />
        ))}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this agent?"
          message="This permanently removes the saved configuration."
          variant="danger"
          confirmLabel="Delete"
          onConfirm={async () => {
            await deleteAgent(confirmDelete);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {confirmReset && (
        <ConfirmDialog
          title="Reset this agent to defaults?"
          message="The system prompt, allowed tools, model override, and assistant prefill will be restored from the bundled defaults. Your customizations will be lost."
          confirmLabel="Reset"
          onConfirm={async () => {
            await resetAgentToDefaults(confirmReset);
            setConfirmReset(null);
          }}
          onCancel={() => setConfirmReset(null)}
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

interface AgentRowProps {
  agent: AgentDefinition;
  onEdit: () => void;
  onDelete: () => void;
  onReset: () => void;
}

function AgentRow({ agent, onEdit, onDelete, onReset }: AgentRowProps) {
  const isBuiltin = agent.kind !== "user";
  const isPipelineOnly =
    agent.kind === "orchestrator" || agent.kind === "verifier";

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {agent.name}
            </span>
            {isPipelineOnly && (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                Pipeline only
              </span>
            )}
            {!isBuiltin && agent.projectId !== null && (
              <span className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Project
              </span>
            )}
          </div>
          {agent.description && (
            <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
              {agent.description}
            </p>
          )}
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {agent.allowedToolIds.length} tool
            {agent.allowedToolIds.length === 1 ? "" : "s"}
            {agent.modelOverride
              ? ` · ${agent.modelOverride.provider} (${agent.modelOverride.model})`
              : " · global model"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            title="Edit"
            className="rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <Pencil size={14} />
          </button>
          {isBuiltin ? (
            <button
              type="button"
              onClick={onReset}
              title="Reset to defaults"
              className="rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            >
              <RotateCcw size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onDelete}
              title="Delete"
              className="rounded p-1 text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-neutral-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
