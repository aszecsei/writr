"use client";

import { Eye, EyeOff, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { updateAppSettings } from "@/db/operations";
import type { ReasoningEffort } from "@/db/schemas";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useUiStore } from "@/store/uiStore";

const FONT_OPTIONS = [
  { value: "literata", label: "Literata", style: "serif" },
  { value: "lusitana", label: "Lusitana", style: "serif" },
  { value: "lora", label: "Lora", style: "serif" },
  { value: "merriweather", label: "Merriweather", style: "serif" },
  { value: "inter", label: "Inter", style: "sans-serif" },
  { value: "source-sans-3", label: "Source Sans 3", style: "sans-serif" },
  { value: "lexend", label: "Lexend", style: "sans-serif" },
  {
    value: "atkinson-hyperlegible",
    label: "Atkinson Hyperlegible",
    style: "sans-serif",
  },
];

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const REASONING_EFFORT_OPTIONS: { value: ReasoningEffort; label: string }[] = [
  { value: "xhigh", label: "Extra High" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "minimal", label: "Minimal" },
  { value: "none", label: "None" },
];

export function AppSettingsDialog() {
  const activeModal = useUiStore((s) => s.activeModal);
  const closeModal = useUiStore((s) => s.closeModal);
  const settings = useAppSettings();

  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [editorFont, setEditorFont] = useState("literata");
  const [editorFontSize, setEditorFontSize] = useState(16);
  const [autoSaveSeconds, setAutoSaveSeconds] = useState(3);
  const [readingSpeedWpm, setReadingSpeedWpm] = useState(200);
  const [openRouterApiKey, setOpenRouterApiKey] = useState("");
  const [preferredModel, setPreferredModel] = useState("openai/gpt-4o");
  const [debugMode, setDebugMode] = useState(false);
  const [streamResponses, setStreamResponses] = useState(true);
  const [reasoningEffort, setReasoningEffort] =
    useState<ReasoningEffort>("medium");
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (settings) {
      setTheme(settings.theme);
      setEditorFont(settings.editorFont);
      setEditorFontSize(settings.editorFontSize);
      setAutoSaveSeconds(Math.round(settings.autoSaveIntervalMs / 1000));
      setReadingSpeedWpm(settings.readingSpeedWpm);
      setOpenRouterApiKey(settings.openRouterApiKey);
      setPreferredModel(settings.preferredModel);
      setDebugMode(settings.debugMode);
      setStreamResponses(settings.streamResponses);
      setReasoningEffort(settings.reasoningEffort);
    }
  }, [settings]);

  if (activeModal !== "app-settings") return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await updateAppSettings({
      theme,
      editorFont,
      editorFontSize,
      autoSaveIntervalMs: autoSaveSeconds * 1000,
      readingSpeedWpm,
      openRouterApiKey,
      preferredModel,
      debugMode,
      streamResponses,
      reasoningEffort,
    });
    closeModal();
  }

  const inputClass =
    "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";

  const labelClass =
    "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <button
          type="button"
          onClick={closeModal}
          className="absolute right-4 top-4 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label="Close dialog"
        >
          <X size={16} />
        </button>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          App Settings
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-6">
          {/* Appearance */}
          <fieldset>
            <legend className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Appearance
            </legend>
            <div className="mt-2">
              <label className={labelClass}>
                Theme
                <select
                  value={theme}
                  onChange={(e) =>
                    setTheme(e.target.value as "light" | "dark" | "system")
                  }
                  className={inputClass}
                >
                  {THEME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          {/* Editor */}
          <fieldset>
            <legend className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Editor
            </legend>
            <div className="mt-2 space-y-4">
              <label className={labelClass}>
                Font Family
                <select
                  value={editorFont}
                  onChange={(e) => setEditorFont(e.target.value)}
                  className={inputClass}
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label} ({font.style})
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className={labelClass}>
                  Font Size (px)
                  <input
                    type="number"
                    min={10}
                    max={32}
                    value={editorFontSize}
                    onChange={(e) => setEditorFontSize(Number(e.target.value))}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Auto-save (seconds)
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={autoSaveSeconds}
                    onChange={(e) => setAutoSaveSeconds(Number(e.target.value))}
                    className={inputClass}
                  />
                </label>
              </div>
              <label className={labelClass}>
                Reading Speed (WPM)
                <input
                  type="number"
                  min={100}
                  max={500}
                  value={readingSpeedWpm}
                  onChange={(e) => setReadingSpeedWpm(Number(e.target.value))}
                  className={inputClass}
                />
                <span className="mt-1 block text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  Words per minute for reading time estimates (default: 200)
                </span>
              </label>
            </div>
          </fieldset>

          {/* AI Integration */}
          <fieldset>
            <legend className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              AI Integration
            </legend>
            <div className="mt-2 space-y-4">
              <label className={labelClass}>
                OpenRouter API Key
                <div className="relative mt-1">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={openRouterApiKey}
                    onChange={(e) => setOpenRouterApiKey(e.target.value)}
                    className={`${inputClass} mt-0 pr-10`}
                    placeholder="sk-or-..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    title={showApiKey ? "Hide API key" : "Show API key"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-500 transition-colors hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:text-zinc-200"
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
                  onChange={(e) => setPreferredModel(e.target.value)}
                  className={inputClass}
                  placeholder="openai/gpt-4o"
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={streamResponses}
                  onChange={(e) => setStreamResponses(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                />
                Stream responses
                <span className="font-normal text-xs text-zinc-500 dark:text-zinc-400">
                  — show text as it generates
                </span>
              </label>
              <label className={labelClass}>
                Reasoning Effort
                <select
                  value={reasoningEffort}
                  onChange={(e) =>
                    setReasoningEffort(e.target.value as ReasoningEffort)
                  }
                  className={inputClass}
                >
                  {REASONING_EFFORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  Controls how much the model reasons before responding.
                  Requires a reasoning-capable model.
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={debugMode}
                  onChange={(e) => setDebugMode(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                />
                Debug mode (dry-run)
                <span className="font-normal text-xs text-zinc-500 dark:text-zinc-400">
                  — show prompt instead of calling AI
                </span>
              </label>
            </div>
          </fieldset>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-zinc-800 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
