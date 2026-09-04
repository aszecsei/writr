"use client";

import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import {
  ALL_READ_TOOL_IDS,
  MUTATIONS_GROUPS,
  READS_GROUPS,
  readsMasterState,
  rowState,
  type ToolPickerRow,
  toggleAllReads,
  toggleRow,
} from "@/components/settings/agent-tool-picker";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  BUTTON_CANCEL,
  BUTTON_PRIMARY,
  CHECKBOX_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  LEGEND_CLASS,
} from "@/components/ui/form-styles";
import { TriStateCheckbox } from "@/components/ui/TriStateCheckbox";
import {
  createAgent,
  deleteAgent,
  resetAgentToDefaults,
  updateAgent,
} from "@/db/operations/agents";
import type {
  AgentDefinitionId,
  AgentModelOverride,
  AiProvider,
  ProjectId,
  ReasoningEffort,
} from "@/db/schemas";
import { useAgent } from "@/hooks/data/useAgents";
import { PROVIDERS } from "@/lib/ai/providers";

const PROVIDER_OPTIONS: { value: AiProvider; label: string }[] = [
  { value: "openrouter", label: "OpenRouter" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "grok", label: "Grok (xAI)" },
  { value: "zai", label: "z.ai (Zhipu AI)" },
  { value: "google", label: "Google AI Studio" },
  { value: "vertex", label: "Vertex AI" },
];

const REASONING_OPTIONS: { value: ReasoningEffort; label: string }[] = [
  { value: "xhigh", label: "Extra High" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "minimal", label: "Minimal" },
  { value: "none", label: "None" },
];

interface AgentEditorBodyProps {
  projectId: ProjectId | null;
  /** null = create a new user agent. */
  agentId: AgentDefinitionId | null;
  /** Called after a successful create/update with the saved row's id. */
  onSaved: (id: AgentDefinitionId) => void;
  /** Called when the user backs out without saving. */
  onCancel: () => void;
  /** Called after a user agent is deleted. */
  onDeleted: () => void;
}

/**
 * Full-page agent editor. Handles built-in agents (scope locked global,
 * reset instead of delete) and user agents (scope selectable, deletable).
 */
export function AgentEditorBody({
  projectId,
  agentId,
  onSaved,
  onCancel,
  onDeleted,
}: AgentEditorBodyProps) {
  const existing = useAgent(agentId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [scope, setScope] = useState<"project" | "global">("project");
  const [allowedToolIds, setAllowedToolIds] = useState<Set<string>>(new Set());
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overrideProvider, setOverrideProvider] =
    useState<AiProvider>("openrouter");
  const [overrideModel, setOverrideModel] = useState("");
  const [overrideReasoning, setOverrideReasoning] =
    useState<ReasoningEffort>("medium");
  const [assistantPrefill, setAssistantPrefill] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Re-seed form fields whenever the target agent changes OR its persisted
  // version changes (e.g. after Reset to defaults rewrites the row). Keying on
  // `updatedAt` keeps user keystrokes intact — it only changes when the row is
  // actually written.
  const loadedUpdatedAt = existing?.updatedAt;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `existing` identity is unstable (useLiveQuery); re-seed only when the row id or its persisted version changes
  useEffect(() => {
    if (!agentId) {
      setName("");
      setDescription("");
      setSystemPrompt("");
      setScope("project");
      setAllowedToolIds(new Set());
      setOverrideEnabled(false);
      setOverrideModel("");
      setAssistantPrefill("");
      return;
    }
    if (!existing) return;
    setName(existing.name);
    setDescription(existing.description);
    setSystemPrompt(existing.systemPrompt);
    setScope(existing.projectId === null ? "global" : "project");
    setAllowedToolIds(new Set(existing.allowedToolIds));
    setOverrideEnabled(existing.modelOverride !== null);
    if (existing.modelOverride) {
      setOverrideProvider(existing.modelOverride.provider);
      setOverrideModel(existing.modelOverride.model);
      setOverrideReasoning(existing.modelOverride.reasoningEffort ?? "medium");
    }
    setAssistantPrefill(existing.assistantPrefill);
  }, [agentId, loadedUpdatedAt]);

  const isBuiltin = !!existing && existing.kind !== "user";

  function toggleRowIds(row: ToolPickerRow) {
    setAllowedToolIds((prev) => toggleRow(row, prev));
  }

  function toggleAllReadIds() {
    setAllowedToolIds((prev) => toggleAllReads(prev));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const modelOverride: AgentModelOverride | null = overrideEnabled
      ? {
          provider: overrideProvider,
          model: overrideModel || PROVIDERS[overrideProvider].defaultModel,
          reasoningEffort: overrideReasoning,
        }
      : null;
    if (agentId && existing) {
      await updateAgent(agentId, {
        name: name.trim(),
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        allowedToolIds: [...allowedToolIds],
        modelOverride,
        assistantPrefill,
        // Built-in agents stay global; only user agents can change scope.
        ...(existing.kind === "user"
          ? { projectId: scope === "global" ? null : (projectId ?? null) }
          : {}),
      });
      onSaved(agentId);
    } else {
      const created = await createAgent({
        kind: "user",
        projectId: scope === "global" ? null : (projectId ?? null),
        name: name.trim(),
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        allowedToolIds: [...allowedToolIds],
        modelOverride,
        assistantPrefill,
      });
      onSaved(created.id);
    }
  }

  const canSubmit = name.trim().length > 0 && systemPrompt.trim().length > 0;
  const masterReadsState = readsMasterState(allowedToolIds);
  const readsActiveCount = ALL_READ_TOOL_IDS.reduce(
    (n, id) => n + (allowedToolIds.has(id) ? 1 : 0),
    0,
  );

  const headerTitle = agentId
    ? isBuiltin
      ? `Edit ${existing?.name ?? "agent"}`
      : "Edit Agent"
    : "New Agent";

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-200 px-8 py-4 dark:border-neutral-800">
        <button
          type="button"
          onClick={onCancel}
          className="mb-2 inline-flex items-center gap-1 text-xs text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          <ArrowLeft size={14} />
          Back to agents
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {headerTitle}
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {isBuiltin
                ? "Built-in agent. Edit the system prompt, allowed tools, or model override; use Reset to restore defaults."
                : "Saved AI workflow — pair a system prompt with a tool subset and an optional model override."}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {isBuiltin && (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className={`${BUTTON_CANCEL} inline-flex items-center gap-1.5`}
              >
                <RotateCcw size={14} />
                Reset
              </button>
            )}
            {agentId && !isBuiltin && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <Trash2 size={14} />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <form
          onSubmit={handleSubmit}
          className="mx-auto max-w-3xl space-y-4"
          id="agent-editor-form"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={LABEL_CLASS}>
              Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Continuity Auditor"
                className={INPUT_CLASS}
              />
            </label>
            {!isBuiltin && (
              <label className={LABEL_CLASS}>
                Scope
                <select
                  value={scope}
                  onChange={(e) =>
                    setScope(e.target.value as "project" | "global")
                  }
                  className={INPUT_CLASS}
                >
                  <option value="project">This project only</option>
                  <option value="global">Global (all projects)</option>
                </select>
              </label>
            )}
          </div>

          <label className={LABEL_CLASS}>
            Description
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — shown in agent picker"
              className={INPUT_CLASS}
            />
          </label>

          <label className={LABEL_CLASS}>
            System Prompt
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              required
              rows={10}
              placeholder="Define the agent's role, output format, and any constraints."
              className={`${INPUT_CLASS} font-mono`}
            />
          </label>

          <label className={LABEL_CLASS}>
            Assistant Prefill (optional)
            <input
              type="text"
              value={assistantPrefill}
              onChange={(e) => setAssistantPrefill(e.target.value)}
              placeholder='e.g. "Here is my analysis:" — primes the assistant turn'
              className={INPUT_CLASS}
            />
          </label>

          <fieldset className="rounded-md border border-neutral-200 p-3 dark:border-neutral-700">
            <legend className={`px-1 ${LEGEND_CLASS}`}>
              Allowed Tools ({allowedToolIds.size})
            </legend>
            <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
              Tools the agent may invoke. Empty = text-only (no tool calling).
              Pipeline-only tools require an active agent run for context — only
              useful inside the manuscript pipeline.
            </p>

            <div className="space-y-4">
              {/* Reads section: master toggle + per-category rows. */}
              <section>
                <label
                  htmlFor="agent-tool-master-reads"
                  className="flex items-center gap-2 border-b border-neutral-200 pb-2 text-sm font-semibold text-neutral-800 dark:border-neutral-700 dark:text-neutral-200"
                >
                  <TriStateCheckbox
                    id="agent-tool-master-reads"
                    state={masterReadsState}
                    onToggle={toggleAllReadIds}
                    className="h-3.5 w-3.5 rounded border-neutral-300 dark:border-neutral-600"
                    ariaLabel="Toggle all reads"
                  />
                  <span>
                    Reads{" "}
                    <span className="font-normal text-neutral-500 dark:text-neutral-400">
                      ({readsActiveCount}/{ALL_READ_TOOL_IDS.length})
                    </span>
                  </span>
                </label>

                <div className="mt-2 space-y-3 pl-5">
                  {READS_GROUPS.map((group) => (
                    <div key={group.heading}>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        {group.heading}
                      </h4>
                      <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {group.rows.map((row) => (
                          <label
                            key={row.key}
                            htmlFor={`agent-tool-${row.key}`}
                            className="flex items-start gap-2 text-xs text-neutral-700 dark:text-neutral-300"
                          >
                            <TriStateCheckbox
                              id={`agent-tool-${row.key}`}
                              state={rowState(row, allowedToolIds)}
                              onToggle={() => toggleRowIds(row)}
                              className="mt-0.5 h-3 w-3 rounded border-neutral-300 dark:border-neutral-600"
                              ariaLabel={`Toggle ${row.label}`}
                            />
                            <span className="leading-tight">
                              <span>{row.label}</span>
                              {row.hint && (
                                <span className="block font-mono text-[10px] text-neutral-500 dark:text-neutral-400">
                                  {row.hint}
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Mutations: flat per-tool checkboxes, grouped by entity. */}
              <section>
                <h3 className="border-b border-neutral-200 pb-2 text-sm font-semibold text-neutral-800 dark:border-neutral-700 dark:text-neutral-200">
                  Mutations
                </h3>
                <div className="mt-2 space-y-3">
                  {MUTATIONS_GROUPS.map((group) => (
                    <div key={group.heading}>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        {group.heading}
                      </h4>
                      <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {group.rows.map((row) => (
                          <label
                            key={row.key}
                            htmlFor={`agent-tool-${row.key}`}
                            className="flex items-start gap-2 text-xs text-neutral-700 dark:text-neutral-300"
                          >
                            <TriStateCheckbox
                              id={`agent-tool-${row.key}`}
                              state={rowState(row, allowedToolIds)}
                              onToggle={() => toggleRowIds(row)}
                              className="mt-0.5 h-3 w-3 rounded border-neutral-300 dark:border-neutral-600"
                              ariaLabel={`Toggle ${row.label}`}
                            />
                            <span className="font-mono leading-tight">
                              {row.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </fieldset>

          <fieldset className="rounded-md border border-neutral-200 p-3 dark:border-neutral-700">
            <legend className={`px-1 ${LEGEND_CLASS}`}>
              Model Override (optional)
            </legend>
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={overrideEnabled}
                onChange={(e) => setOverrideEnabled(e.target.checked)}
                className={CHECKBOX_CLASS}
              />
              Use a specific provider/model for this agent
            </label>
            {overrideEnabled && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className={LABEL_CLASS}>
                  Provider
                  <select
                    value={overrideProvider}
                    onChange={(e) =>
                      setOverrideProvider(e.target.value as AiProvider)
                    }
                    className={INPUT_CLASS}
                  >
                    {PROVIDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={LABEL_CLASS}>
                  Model
                  <input
                    type="text"
                    value={overrideModel}
                    onChange={(e) => setOverrideModel(e.target.value)}
                    placeholder={PROVIDERS[overrideProvider].defaultModel}
                    className={INPUT_CLASS}
                  />
                </label>
                <label className={LABEL_CLASS}>
                  Reasoning
                  <select
                    value={overrideReasoning}
                    onChange={(e) =>
                      setOverrideReasoning(e.target.value as ReasoningEffort)
                    }
                    className={INPUT_CLASS}
                  >
                    {REASONING_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </fieldset>

          <div className="flex justify-end gap-2 pb-4">
            <button type="button" onClick={onCancel} className={BUTTON_CANCEL}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={BUTTON_PRIMARY}
            >
              {agentId ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>

      {confirmDelete && agentId && (
        <ConfirmDialog
          title="Delete this agent?"
          message="This permanently removes the saved configuration."
          variant="danger"
          confirmLabel="Delete"
          onConfirm={async () => {
            await deleteAgent(agentId);
            setConfirmDelete(false);
            onDeleted();
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {confirmReset && agentId && (
        <ConfirmDialog
          title="Reset this agent to defaults?"
          message="The system prompt, allowed tools, model override, and assistant prefill will be restored from the bundled defaults. Your customizations will be lost."
          confirmLabel="Reset"
          onConfirm={async () => {
            await resetAgentToDefaults(agentId);
            setConfirmReset(false);
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}
