"use client";

import type {
  AgentKind,
  AgentModelOverride,
  AiProvider,
  ReasoningEffort,
} from "@/db/schemas";
import { PROVIDERS } from "@/lib/ai/providers";

const AGENT_KINDS: { value: AgentKind; label: string; description: string }[] =
  [
    {
      value: "reader",
      label: "Reader",
      description:
        "Iteratively reads the manuscript, builds the reader-bible, logs notes/questions.",
    },
    {
      value: "orchestrator",
      label: "Orchestrator",
      description:
        "Converts notes into a tiered plan of work units. Strong reasoning recommended.",
    },
    {
      value: "editor",
      label: "Editor",
      description:
        "Proposes developmental edits per work unit. Balanced/creative model recommended.",
    },
    {
      value: "verifier",
      label: "Verifier",
      description:
        "Re-reads after each tier; flags goal misses and continuity breaks.",
    },
  ];

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

interface AgentSettingsProps {
  overrides: Record<AgentKind, AgentModelOverride | null>;
  globalProvider: AiProvider;
  globalModel: string;
  globalReasoningEffort: ReasoningEffort;
  onChange: (kind: AgentKind, override: AgentModelOverride | null) => void;
  inputClass: string;
  labelClass: string;
}

export function AgentSettings({
  overrides,
  globalProvider,
  globalModel,
  globalReasoningEffort,
  onChange,
  inputClass,
  labelClass,
}: AgentSettingsProps) {
  return (
    <fieldset>
      <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Pipeline Agents
      </legend>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        Override the model used by each agent in the manuscript review/edit
        pipeline. Leave disabled to use your default provider and model.
      </p>
      <div className="mt-4 space-y-5">
        {AGENT_KINDS.map(({ value, label, description }) => (
          <AgentOverrideRow
            key={value}
            kind={value}
            label={label}
            description={description}
            override={overrides[value] ?? null}
            globalProvider={globalProvider}
            globalModel={globalModel}
            globalReasoningEffort={globalReasoningEffort}
            onChange={onChange}
            inputClass={inputClass}
            labelClass={labelClass}
          />
        ))}
      </div>
    </fieldset>
  );
}

interface AgentOverrideRowProps {
  kind: AgentKind;
  label: string;
  description: string;
  override: AgentModelOverride | null;
  globalProvider: AiProvider;
  globalModel: string;
  globalReasoningEffort: ReasoningEffort;
  onChange: (kind: AgentKind, override: AgentModelOverride | null) => void;
  inputClass: string;
  labelClass: string;
}

function AgentOverrideRow({
  kind,
  label,
  description,
  override,
  globalProvider,
  globalModel,
  globalReasoningEffort,
  onChange,
  inputClass,
  labelClass,
}: AgentOverrideRowProps) {
  const enabled = override !== null;

  function toggle(next: boolean) {
    if (next) {
      onChange(kind, {
        provider: globalProvider,
        model: globalModel,
        reasoningEffort: globalReasoningEffort,
      });
    } else {
      onChange(kind, null);
    }
  }

  function patch(partial: Partial<AgentModelOverride>) {
    if (!override) return;
    onChange(kind, { ...override, ...partial });
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900/50">
      <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggle(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
        />
        {label}
      </label>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        {description}
      </p>
      {enabled && override && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className={labelClass}>
            Provider
            <select
              value={override.provider}
              onChange={(e) =>
                patch({ provider: e.target.value as AiProvider })
              }
              className={inputClass}
            >
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Model
            <input
              type="text"
              value={override.model}
              onChange={(e) => patch({ model: e.target.value })}
              className={inputClass}
              placeholder={PROVIDERS[override.provider].defaultModel}
            />
          </label>
          <label className={labelClass}>
            Reasoning
            <select
              value={override.reasoningEffort ?? "medium"}
              onChange={(e) =>
                patch({ reasoningEffort: e.target.value as ReasoningEffort })
              }
              className={inputClass}
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
    </div>
  );
}
