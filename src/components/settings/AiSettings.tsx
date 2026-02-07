"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import type { ReasoningEffort } from "@/db/schemas";

const REASONING_EFFORT_OPTIONS: { value: ReasoningEffort; label: string }[] = [
  { value: "xhigh", label: "Extra High" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "minimal", label: "Minimal" },
  { value: "none", label: "None" },
];

interface AiSettingsProps {
  enableAiFeatures: boolean;
  openRouterApiKey: string;
  preferredModel: string;
  streamResponses: boolean;
  reasoningEffort: ReasoningEffort;
  debugMode: boolean;
  onEnableAiFeaturesChange: (enabled: boolean) => void;
  onOpenRouterApiKeyChange: (key: string) => void;
  onPreferredModelChange: (model: string) => void;
  onStreamResponsesChange: (enabled: boolean) => void;
  onReasoningEffortChange: (effort: ReasoningEffort) => void;
  onDebugModeChange: (enabled: boolean) => void;
  inputClass: string;
  labelClass: string;
}

export function AiSettings({
  enableAiFeatures,
  openRouterApiKey,
  preferredModel,
  streamResponses,
  reasoningEffort,
  debugMode,
  onEnableAiFeaturesChange,
  onOpenRouterApiKeyChange,
  onPreferredModelChange,
  onStreamResponsesChange,
  onReasoningEffortChange,
  onDebugModeChange,
  inputClass,
  labelClass,
}: AiSettingsProps) {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <fieldset>
      <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        AI Integration
      </legend>
      <div className="mt-2 space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={enableAiFeatures}
            onChange={(e) => onEnableAiFeaturesChange(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
          />
          Enable AI features
          <span className="font-normal text-xs text-neutral-500 dark:text-neutral-400">
            — show AI panel and tools
          </span>
        </label>
        {enableAiFeatures && (
          <>
            <label className={labelClass}>
              OpenRouter API Key
              <div className="relative mt-1">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={openRouterApiKey}
                  onChange={(e) => onOpenRouterApiKeyChange(e.target.value)}
                  className={`${inputClass} mt-0 pr-10`}
                  placeholder="sk-or-..."
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  title={showApiKey ? "Hide API key" : "Show API key"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-500 transition-colors hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:text-neutral-200"
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <label className={labelClass}>
              Preferred Model
              <input
                type="text"
                value={preferredModel}
                onChange={(e) => onPreferredModelChange(e.target.value)}
                className={inputClass}
                placeholder="openai/gpt-4o"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={streamResponses}
                onChange={(e) => onStreamResponsesChange(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
              />
              Stream responses
              <span className="font-normal text-xs text-neutral-500 dark:text-neutral-400">
                — show text as it generates
              </span>
            </label>
            <label className={labelClass}>
              Reasoning Effort
              <select
                value={reasoningEffort}
                onChange={(e) =>
                  onReasoningEffortChange(e.target.value as ReasoningEffort)
                }
                className={inputClass}
              >
                {REASONING_EFFORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                Controls how much the model reasons before responding. Requires
                a reasoning-capable model.
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={debugMode}
                onChange={(e) => onDebugModeChange(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
              />
              Debug mode (dry-run)
              <span className="font-normal text-xs text-neutral-500 dark:text-neutral-400">
                — show prompt instead of calling AI
              </span>
            </label>
          </>
        )}
      </div>
    </fieldset>
  );
}
