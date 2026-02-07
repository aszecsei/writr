"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import type { AiProvider, ReasoningEffort } from "@/db/schemas";
import { PROVIDERS } from "@/lib/ai/providers";

const REASONING_EFFORT_OPTIONS: { value: ReasoningEffort; label: string }[] = [
  { value: "xhigh", label: "Extra High" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "minimal", label: "Minimal" },
  { value: "none", label: "None" },
];

const PROVIDER_OPTIONS: { value: AiProvider; label: string }[] = [
  { value: "openrouter", label: "OpenRouter" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "grok", label: "Grok (xAI)" },
  { value: "zai", label: "z.ai (Zhipu AI)" },
];

interface AiSettingsProps {
  enableAiFeatures: boolean;
  aiProvider: AiProvider;
  providerApiKeys: Record<AiProvider, string>;
  providerModels: Record<AiProvider, string>;
  streamResponses: boolean;
  reasoningEffort: ReasoningEffort;
  debugMode: boolean;
  postChatInstructions: string;
  postChatInstructionsDepth: number;
  assistantPrefill: string;
  onEnableAiFeaturesChange: (enabled: boolean) => void;
  onAiProviderChange: (provider: AiProvider) => void;
  onProviderApiKeyChange: (provider: AiProvider, key: string) => void;
  onProviderModelChange: (provider: AiProvider, model: string) => void;
  onStreamResponsesChange: (enabled: boolean) => void;
  onReasoningEffortChange: (effort: ReasoningEffort) => void;
  onDebugModeChange: (enabled: boolean) => void;
  onPostChatInstructionsChange: (value: string) => void;
  onPostChatInstructionsDepthChange: (value: number) => void;
  onAssistantPrefillChange: (value: string) => void;
  inputClass: string;
  labelClass: string;
}

function ApiKeyInput({
  id,
  value,
  onChange,
  placeholder,
  inputClass,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputClass: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative mt-1">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} mt-0 pr-10`}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        title={show ? "Hide API key" : "Show API key"}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-500 transition-colors hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export function AiSettings({
  enableAiFeatures,
  aiProvider,
  providerApiKeys,
  providerModels,
  streamResponses,
  reasoningEffort,
  debugMode,
  postChatInstructions,
  postChatInstructionsDepth,
  assistantPrefill,
  onEnableAiFeaturesChange,
  onAiProviderChange,
  onProviderApiKeyChange,
  onProviderModelChange,
  onStreamResponsesChange,
  onReasoningEffortChange,
  onDebugModeChange,
  onPostChatInstructionsChange,
  onPostChatInstructionsDepthChange,
  onAssistantPrefillChange,
  inputClass,
  labelClass,
}: AiSettingsProps) {
  const providerConfig = PROVIDERS[aiProvider];

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
              Provider
              <select
                value={aiProvider}
                onChange={(e) =>
                  onAiProviderChange(e.target.value as AiProvider)
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
            <label htmlFor="ai-api-key" className={labelClass}>
              {providerConfig.label} API Key
              <ApiKeyInput
                id="ai-api-key"
                value={providerApiKeys[aiProvider]}
                onChange={(key) => onProviderApiKeyChange(aiProvider, key)}
                placeholder={providerConfig.apiKeyPrefix}
                inputClass={inputClass}
              />
            </label>
            <label className={labelClass}>
              Preferred Model
              <input
                type="text"
                value={providerModels[aiProvider]}
                onChange={(e) =>
                  onProviderModelChange(aiProvider, e.target.value)
                }
                className={inputClass}
                placeholder={providerConfig.defaultModel}
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
            <fieldset className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
              <legend className="px-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Post-Chat Instructions
              </legend>
              <div className="space-y-3">
                <label className={labelClass}>
                  Instructions
                  <textarea
                    value={postChatInstructions}
                    onChange={(e) =>
                      onPostChatInstructionsChange(e.target.value)
                    }
                    className={`${inputClass} min-h-[80px] resize-y`}
                    placeholder="Custom instructions appended to your messages..."
                    rows={3}
                  />
                  <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    Injected into your messages before sending to the AI. Not
                    visible in chat history.
                  </span>
                </label>
                <label className={labelClass}>
                  Injection Depth
                  <input
                    type="number"
                    value={postChatInstructionsDepth}
                    onChange={(e) =>
                      onPostChatInstructionsDepthChange(
                        Math.max(0, Math.round(Number(e.target.value))),
                      )
                    }
                    className={inputClass}
                    min={0}
                    max={10}
                  />
                  <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    Which user message to append to, counting from the end. 1 =
                    latest message, 2 = second-to-last. 0 = disabled.
                  </span>
                </label>
              </div>
            </fieldset>
            <fieldset className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
              <legend className="px-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Assistant Prefill
              </legend>
              <label className={labelClass}>
                Prefill Text
                <textarea
                  value={assistantPrefill}
                  onChange={(e) => onAssistantPrefillChange(e.target.value)}
                  className={`${inputClass} min-h-[80px] resize-y`}
                  placeholder="Text the assistant begins its response with..."
                  rows={3}
                />
                <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                  Appended as a final assistant message so the model continues
                  from this text. Useful for guiding output format or style.
                </span>
              </label>
            </fieldset>
          </>
        )}
      </div>
    </fieldset>
  );
}
