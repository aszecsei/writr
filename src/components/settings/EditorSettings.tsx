"use client";

import { EDITOR_FONTS, type EditorFont } from "@/lib/fonts";

const CATEGORY_STYLE_LABELS: Record<EditorFont["category"], string> = {
  serif: "serif",
  sans: "sans-serif",
  accessible: "accessible",
  mono: "monospace",
};

interface EditorSettingsProps {
  editorFont: string;
  editorFontSize: number;
  autoSaveSeconds: number;
  readingSpeedWpm: number;
  autoFocusModeOnSprint: boolean;
  grammarCheckerEnabled: boolean;
  holeOpenDelimiter: string;
  holeCloseDelimiter: string;
  holeHighlightOpacity: number;
  onEditorFontChange: (font: string) => void;
  onEditorFontSizeChange: (size: number) => void;
  onAutoSaveSecondsChange: (seconds: number) => void;
  onReadingSpeedWpmChange: (wpm: number) => void;
  onAutoFocusModeOnSprintChange: (enabled: boolean) => void;
  onGrammarCheckerEnabledChange: (enabled: boolean) => void;
  onHoleOpenDelimiterChange: (value: string) => void;
  onHoleCloseDelimiterChange: (value: string) => void;
  onHoleHighlightOpacityChange: (value: number) => void;
  onManageDictionaries?: () => void;
  onManageGrammarRules?: () => void;
  inputClass: string;
  labelClass: string;
}

export function EditorSettings({
  editorFont,
  editorFontSize,
  autoSaveSeconds,
  readingSpeedWpm,
  autoFocusModeOnSprint,
  grammarCheckerEnabled,
  holeOpenDelimiter,
  holeCloseDelimiter,
  holeHighlightOpacity,
  onEditorFontChange,
  onEditorFontSizeChange,
  onAutoSaveSecondsChange,
  onReadingSpeedWpmChange,
  onAutoFocusModeOnSprintChange,
  onGrammarCheckerEnabledChange,
  onHoleOpenDelimiterChange,
  onHoleCloseDelimiterChange,
  onHoleHighlightOpacityChange,
  onManageDictionaries,
  onManageGrammarRules,
  inputClass,
  labelClass,
}: EditorSettingsProps) {
  return (
    <fieldset>
      <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Editor
      </legend>
      <div className="mt-2 space-y-4">
        <label className={labelClass}>
          Font Family
          <select
            value={editorFont}
            onChange={(e) => onEditorFontChange(e.target.value)}
            className={inputClass}
          >
            {EDITOR_FONTS.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label} ({CATEGORY_STYLE_LABELS[font.category]})
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
              onChange={(e) => onEditorFontSizeChange(Number(e.target.value))}
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
              onChange={(e) => onAutoSaveSecondsChange(Number(e.target.value))}
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
            onChange={(e) => onReadingSpeedWpmChange(Number(e.target.value))}
            className={inputClass}
          />
          <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
            Words per minute for reading time estimates (default: 200)
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={autoFocusModeOnSprint}
            onChange={(e) => onAutoFocusModeOnSprintChange(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
          />
          Auto-enable focus mode when starting a sprint
          <span className="font-normal text-xs text-neutral-500 dark:text-neutral-400">
            — distraction-free writing
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={grammarCheckerEnabled}
            onChange={(e) => onGrammarCheckerEnabledChange(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
          />
          Enable grammar checker
          <span className="font-normal text-xs text-neutral-500 dark:text-neutral-400">
            — real-time grammar & style suggestions
          </span>
        </label>
        {onManageGrammarRules && (
          <button
            type="button"
            onClick={onManageGrammarRules}
            className="-mt-2 text-left text-sm font-medium text-neutral-700 underline underline-offset-2 transition-colors hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
          >
            Manage grammar rules
          </button>
        )}
        <div>
          <span className={labelClass}>Holes</span>
          <p className="mt-1 text-xs font-normal text-neutral-500 dark:text-neutral-400">
            Delimiters that mark a section you're intentionally skipping over.
            Holes are highlighted, excluded from word counts, and flagged before
            export.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <label className={labelClass}>
              Open Delimiter
              <input
                type="text"
                value={holeOpenDelimiter}
                onChange={(e) => onHoleOpenDelimiterChange(e.target.value)}
                placeholder="["
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Close Delimiter
              <input
                type="text"
                value={holeCloseDelimiter}
                onChange={(e) => onHoleCloseDelimiterChange(e.target.value)}
                placeholder="]"
                className={inputClass}
              />
            </label>
          </div>
          <label className={`${labelClass} mt-4`}>
            <span className="flex items-center justify-between">
              <span>Highlight Translucency</span>
              <span className="tabular-nums font-normal text-neutral-500 dark:text-neutral-400">
                {Math.round(holeHighlightOpacity * 100)}%
              </span>
            </span>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={holeHighlightOpacity}
                onChange={(e) =>
                  onHoleHighlightOpacityChange(Number(e.target.value))
                }
                className="flex-1"
                aria-label="Hole highlight translucency"
              />
              <span
                className="rounded px-2 py-1 text-xs text-neutral-700 dark:text-neutral-300"
                style={{
                  backgroundColor: `rgb(250 204 21 / ${holeHighlightOpacity})`,
                }}
              >
                [ hole ]
              </span>
            </div>
            <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
              Keep it low while drafting; raise it while editing so unfilled
              holes stand out.
            </span>
          </label>
        </div>
        {onManageDictionaries && (
          <button
            type="button"
            onClick={onManageDictionaries}
            className="text-sm font-medium text-neutral-700 underline underline-offset-2 transition-colors hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
          >
            Manage Dictionaries
          </button>
        )}
      </div>
    </fieldset>
  );
}
