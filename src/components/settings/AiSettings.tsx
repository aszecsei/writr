"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";
import type { AiProvider, ReasoningEffort } from "@/db/schemas";
import {
  PROVIDER_OPTIONS,
  PROVIDERS,
  REASONING_EFFORT_OPTIONS,
} from "@/lib/ai/providers";
import type {
  AppSettingsDraft,
  SetAppSettingsField,
} from "./AppSettingsDialog";

interface AiSettingsProps {
  draft: AppSettingsDraft;
  setField: SetAppSettingsField;
}

function ApiKeyInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative mt-1">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT_CLASS} mt-0 pr-10`}
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

export function AiSettings({ draft, setField }: AiSettingsProps) {
  const { aiProvider } = draft;
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
            checked={draft.enableAiFeatures}
            onChange={(e) => setField("enableAiFeatures", e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
          />
          Enable AI features
          <span className="font-normal text-xs text-neutral-500 dark:text-neutral-400">
            — show AI panel and tools
          </span>
        </label>
        {draft.enableAiFeatures && (
          <>
            <label className={LABEL_CLASS}>
              Provider
              <select
                value={aiProvider}
                onChange={(e) =>
                  setField("aiProvider", e.target.value as AiProvider)
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
            <label htmlFor="ai-api-key" className={LABEL_CLASS}>
              {providerConfig.label} API Key
              <ApiKeyInput
                id="ai-api-key"
                value={draft.providerApiKeys[aiProvider]}
                onChange={(key) =>
                  setField("providerApiKeys", {
                    ...draft.providerApiKeys,
                    [aiProvider]: key,
                  })
                }
                placeholder={providerConfig.apiKeyPrefix}
              />
            </label>
            <label className={LABEL_CLASS}>
              Preferred Model
              <input
                type="text"
                value={draft.providerModels[aiProvider]}
                onChange={(e) =>
                  setField("providerModels", {
                    ...draft.providerModels,
                    [aiProvider]: e.target.value,
                  })
                }
                className={INPUT_CLASS}
                placeholder={providerConfig.defaultModel}
              />
            </label>
            {aiProvider === "openrouter" && (
              <>
                <label className={LABEL_CLASS}>
                  TTS Model
                  <input
                    type="text"
                    value={draft.providerTtsModels[aiProvider]}
                    onChange={(e) =>
                      setField("providerTtsModels", {
                        ...draft.providerTtsModels,
                        [aiProvider]: e.target.value,
                      })
                    }
                    className={INPUT_CLASS}
                    placeholder="e.g. openai/gpt-4o-mini-tts"
                  />
                  <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    Optional. Leave blank to hide the Read Aloud button. Use a
                    TTS-capable model ID from OpenRouter.
                  </span>
                </label>
                <label className={LABEL_CLASS}>
                  TTS Voice
                  <input
                    type="text"
                    value={draft.providerTtsVoices[aiProvider]}
                    onChange={(e) =>
                      setField("providerTtsVoices", {
                        ...draft.providerTtsVoices,
                        [aiProvider]: e.target.value,
                      })
                    }
                    className={INPUT_CLASS}
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
                checked={draft.streamResponses}
                onChange={(e) => setField("streamResponses", e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
              />
              Stream responses
              <span className="font-normal text-xs text-neutral-500 dark:text-neutral-400">
                — show text as it generates
              </span>
            </label>
            <label className={LABEL_CLASS}>
              Reasoning Effort
              <select
                value={draft.reasoningEffort}
                onChange={(e) =>
                  setField("reasoningEffort", e.target.value as ReasoningEffort)
                }
                className={INPUT_CLASS}
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
                checked={draft.debugMode}
                onChange={(e) => setField("debugMode", e.target.checked)}
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
                checked={draft.enableToolCalling}
                onChange={(e) =>
                  setField("enableToolCalling", e.target.checked)
                }
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
                checked={draft.loreRetrievalEnabled}
                onChange={(e) =>
                  setField("loreRetrievalEnabled", e.target.checked)
                }
                className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
              />
              Surface relevant lore & scenes automatically
              <span className="font-normal text-xs text-neutral-500 dark:text-neutral-400">
                — embed and retrieve worldbuilding lore and prior scenes into
                chat context
              </span>
            </label>
            {draft.loreRetrievalEnabled && (
              <>
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={draft.omniscientMode}
                    onChange={(e) =>
                      setField("omniscientMode", e.target.checked)
                    }
                    className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
                  />
                  Include future scenes (omniscient)
                  <span className="font-normal text-xs text-neutral-500 dark:text-neutral-400">
                    — surface scenes that occur after the current chapter
                  </span>
                </label>
                <label className={LABEL_CLASS}>
                  Lore results (top-K)
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={draft.loreTopK}
                    onChange={(e) => {
                      const next = Number.parseInt(e.target.value, 10);
                      if (Number.isFinite(next) && next >= 0) {
                        setField("loreTopK", next);
                      }
                    }}
                    className={INPUT_CLASS}
                  />
                  <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    Number of lore chunks to surface per chat turn. Default 5.
                  </span>
                </label>
                <label className={LABEL_CLASS}>
                  Scene results (top-K)
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={draft.sceneTopK}
                    onChange={(e) => {
                      const next = Number.parseInt(e.target.value, 10);
                      if (Number.isFinite(next) && next >= 0) {
                        setField("sceneTopK", next);
                      }
                    }}
                    className={INPUT_CLASS}
                  />
                  <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    Number of scene chunks to surface per chat turn. Default 3.
                  </span>
                </label>
                <label className={LABEL_CLASS}>
                  Similarity floor
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={draft.similarityFloor}
                    onChange={(e) => {
                      const next = Number.parseFloat(e.target.value);
                      if (Number.isFinite(next) && next >= 0 && next <= 1) {
                        setField("similarityFloor", next);
                      }
                    }}
                    className={INPUT_CLASS}
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
