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
  { value: "google", label: "Google AI Studio" },
  { value: "vertex", label: "Vertex AI" },
];

interface AiSettingsProps {
  enableAiFeatures: boolean;
  aiProvider: AiProvider;
  providerApiKeys: Record<AiProvider, string>;
  providerModels: Record<AiProvider, string>;
  providerTtsModels: Record<AiProvider, string>;
  providerTtsVoices: Record<AiProvider, string>;
  streamResponses: boolean;
  reasoningEffort: ReasoningEffort;
  debugMode: boolean;
  enableToolCalling: boolean;
  onEnableAiFeaturesChange: (enabled: boolean) => void;
  onAiProviderChange: (provider: AiProvider) => void;
  onProviderApiKeyChange: (provider: AiProvider, key: string) => void;
  onProviderModelChange: (provider: AiProvider, model: string) => void;
  onProviderTtsModelChange: (provider: AiProvider, model: string) => void;
  onProviderTtsVoiceChange: (provider: AiProvider, voice: string) => void;
  onStreamResponsesChange: (enabled: boolean) => void;
  onReasoningEffortChange: (effort: ReasoningEffort) => void;
  onDebugModeChange: (enabled: boolean) => void;
  onEnableToolCallingChange: (enabled: boolean) => void;
  loreRetrievalEnabled: boolean;
  onLoreRetrievalEnabledChange: (enabled: boolean) => void;
  omniscientMode: boolean;
  onOmniscientModeChange: (enabled: boolean) => void;
  loreTopK: number;
  onLoreTopKChange: (value: number) => void;
  sceneTopK: number;
  onSceneTopKChange: (value: number) => void;
  similarityFloor: number;
  onSimilarityFloorChange: (value: number) => void;
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
  providerTtsModels,
  providerTtsVoices,
  streamResponses,
  reasoningEffort,
  debugMode,
  enableToolCalling,
  onEnableAiFeaturesChange,
  onAiProviderChange,
  onProviderApiKeyChange,
  onProviderModelChange,
  onProviderTtsModelChange,
  onProviderTtsVoiceChange,
  onStreamResponsesChange,
  onReasoningEffortChange,
  onDebugModeChange,
  onEnableToolCallingChange,
  loreRetrievalEnabled,
  onLoreRetrievalEnabledChange,
  omniscientMode,
  onOmniscientModeChange,
  loreTopK,
  onLoreTopKChange,
  sceneTopK,
  onSceneTopKChange,
  similarityFloor,
  onSimilarityFloorChange,
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
            {aiProvider === "openrouter" && (
              <>
                <label className={labelClass}>
                  TTS Model
                  <input
                    type="text"
                    value={providerTtsModels[aiProvider]}
                    onChange={(e) =>
                      onProviderTtsModelChange(aiProvider, e.target.value)
                    }
                    className={inputClass}
                    placeholder="e.g. openai/gpt-4o-mini-tts"
                  />
                  <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    Optional. Leave blank to hide the Read Aloud button. Use a
                    TTS-capable model ID from OpenRouter.
                  </span>
                </label>
                <label className={labelClass}>
                  TTS Voice
                  <input
                    type="text"
                    value={providerTtsVoices[aiProvider]}
                    onChange={(e) =>
                      onProviderTtsVoiceChange(aiProvider, e.target.value)
                    }
                    className={inputClass}
                    placeholder="e.g. alloy"
                  />
                  <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    Required for Read Aloud. Voice name as accepted by the
                    selected TTS model (e.g. alloy, echo, fable, onyx, nova,
                    shimmer).
                  </span>
                </label>
              </>
            )}
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
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={enableToolCalling}
                onChange={(e) => onEnableToolCallingChange(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
              />
              Enable tool calling
              <span className="font-normal text-xs text-neutral-500 dark:text-neutral-400">
                — allow AI to create and modify story bible entries (requires
                approval)
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={loreRetrievalEnabled}
                onChange={(e) => onLoreRetrievalEnabledChange(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
              />
              Surface relevant lore & scenes automatically
              <span className="font-normal text-xs text-neutral-500 dark:text-neutral-400">
                — embed and retrieve worldbuilding lore and prior scenes into
                chat context
              </span>
            </label>
            {loreRetrievalEnabled && (
              <>
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={omniscientMode}
                    onChange={(e) => onOmniscientModeChange(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
                  />
                  Include future scenes (omniscient)
                  <span className="font-normal text-xs text-neutral-500 dark:text-neutral-400">
                    — surface scenes that occur after the current chapter
                  </span>
                </label>
                <label className={labelClass}>
                  Lore results (top-K)
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={loreTopK}
                    onChange={(e) => {
                      const next = Number.parseInt(e.target.value, 10);
                      if (Number.isFinite(next) && next >= 0) {
                        onLoreTopKChange(next);
                      }
                    }}
                    className={inputClass}
                  />
                  <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    Number of lore chunks to surface per chat turn. Default 5.
                  </span>
                </label>
                <label className={labelClass}>
                  Scene results (top-K)
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={sceneTopK}
                    onChange={(e) => {
                      const next = Number.parseInt(e.target.value, 10);
                      if (Number.isFinite(next) && next >= 0) {
                        onSceneTopKChange(next);
                      }
                    }}
                    className={inputClass}
                  />
                  <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    Number of scene chunks to surface per chat turn. Default 3.
                  </span>
                </label>
                <label className={labelClass}>
                  Similarity floor
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={similarityFloor}
                    onChange={(e) => {
                      const next = Number.parseFloat(e.target.value);
                      if (Number.isFinite(next) && next >= 0 && next <= 1) {
                        onSimilarityFloorChange(next);
                      }
                    }}
                    className={inputClass}
                  />
                  <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    Minimum cosine similarity (0–1) for a chunk to be included.
                    Lower values surface more results. Default 0.3.
                  </span>
                </label>
              </>
            )}
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Manage agents from the <span className="font-medium">Agents</span>{" "}
              panel in the sidebar — create custom agents and edit built-in ones
              there.
            </p>
          </>
        )}
      </div>
    </fieldset>
  );
}
