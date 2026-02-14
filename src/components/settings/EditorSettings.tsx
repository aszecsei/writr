"use client";

const FONT_OPTIONS = [
  { value: "literata", label: "Literata", style: "serif" },
  { value: "lusitana", label: "Lusitana", style: "serif" },
  { value: "lora", label: "Lora", style: "serif" },
  { value: "merriweather", label: "Merriweather", style: "serif" },
  { value: "eb-garamond", label: "EB Garamond", style: "serif" },
  { value: "crimson-pro", label: "Crimson Pro", style: "serif" },
  { value: "spectral", label: "Spectral", style: "serif" },
  { value: "inter", label: "Inter", style: "sans-serif" },
  { value: "source-sans-3", label: "Source Sans 3", style: "sans-serif" },
  { value: "lexend", label: "Lexend", style: "sans-serif" },
  {
    value: "atkinson-hyperlegible",
    label: "Atkinson Hyperlegible",
    style: "sans-serif",
  },
  { value: "open-dyslexic", label: "OpenDyslexic", style: "accessible" },
  { value: "courier-prime", label: "Courier Prime", style: "monospace" },
  { value: "jetbrains-mono", label: "JetBrains Mono", style: "monospace" },
];

interface EditorSettingsProps {
  editorFont: string;
  editorFontSize: number;
  autoSaveSeconds: number;
  readingSpeedWpm: number;
  autoFocusModeOnSprint: boolean;
  onEditorFontChange: (font: string) => void;
  onEditorFontSizeChange: (size: number) => void;
  onAutoSaveSecondsChange: (seconds: number) => void;
  onReadingSpeedWpmChange: (wpm: number) => void;
  onAutoFocusModeOnSprintChange: (enabled: boolean) => void;
  onManageDictionaries?: () => void;
  inputClass: string;
  labelClass: string;
}

export function EditorSettings({
  editorFont,
  editorFontSize,
  autoSaveSeconds,
  readingSpeedWpm,
  autoFocusModeOnSprint,
  onEditorFontChange,
  onEditorFontSizeChange,
  onAutoSaveSecondsChange,
  onReadingSpeedWpmChange,
  onAutoFocusModeOnSprintChange,
  onManageDictionaries,
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
