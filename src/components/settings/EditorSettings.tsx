"use client";

import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";
import { EDITOR_FONTS, type EditorFont } from "@/lib/fonts";
import type {
  AppSettingsDraft,
  SetAppSettingsField,
} from "./AppSettingsDialog";

const CATEGORY_STYLE_LABELS: Record<EditorFont["category"], string> = {
  serif: "serif",
  sans: "sans-serif",
  accessible: "accessible",
  mono: "monospace",
};

interface EditorSettingsProps {
  draft: AppSettingsDraft;
  setField: SetAppSettingsField;
  onHoleHighlightOpacityChange: (value: number) => void;
  onManageDictionaries?: () => void;
  onManageGrammarRules?: () => void;
}

export function EditorSettings({
  draft,
  setField,
  onHoleHighlightOpacityChange,
  onManageDictionaries,
  onManageGrammarRules,
}: EditorSettingsProps) {
  return (
    <fieldset>
      <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Editor
      </legend>
      <div className="mt-2 space-y-4">
        <label className={LABEL_CLASS}>
          Font Family
          <select
            value={draft.editorFont}
            onChange={(e) => setField("editorFont", e.target.value)}
            className={INPUT_CLASS}
          >
            {EDITOR_FONTS.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label} ({CATEGORY_STYLE_LABELS[font.category]})
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className={LABEL_CLASS}>
            Font Size (px)
            <input
              type="number"
              min={10}
              max={32}
              value={draft.editorFontSize}
              onChange={(e) =>
                setField("editorFontSize", Number(e.target.value))
              }
              className={INPUT_CLASS}
            />
          </label>
          <label className={LABEL_CLASS}>
            Auto-save (seconds)
            <input
              type="number"
              min={1}
              max={60}
              value={draft.autoSaveSeconds}
              onChange={(e) =>
                setField("autoSaveSeconds", Number(e.target.value))
              }
              className={INPUT_CLASS}
            />
          </label>
        </div>
        <label className={LABEL_CLASS}>
          Reading Speed (WPM)
          <input
            type="number"
            min={100}
            max={500}
            value={draft.readingSpeedWpm}
            onChange={(e) =>
              setField("readingSpeedWpm", Number(e.target.value))
            }
            className={INPUT_CLASS}
          />
          <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
            Words per minute for reading time estimates (default: 200)
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={draft.autoFocusModeOnSprint}
            onChange={(e) =>
              setField("autoFocusModeOnSprint", e.target.checked)
            }
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
            checked={draft.grammarCheckerEnabled}
            onChange={(e) =>
              setField("grammarCheckerEnabled", e.target.checked)
            }
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
          <span className={LABEL_CLASS}>Holes</span>
          <p className="mt-1 text-xs font-normal text-neutral-500 dark:text-neutral-400">
            Delimiters that mark a section you're intentionally skipping over.
            Holes are highlighted, excluded from word counts, and flagged before
            export.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <label className={LABEL_CLASS}>
              Open Delimiter
              <input
                type="text"
                value={draft.holeOpenDelimiter}
                onChange={(e) => setField("holeOpenDelimiter", e.target.value)}
                placeholder="["
                className={INPUT_CLASS}
              />
            </label>
            <label className={LABEL_CLASS}>
              Close Delimiter
              <input
                type="text"
                value={draft.holeCloseDelimiter}
                onChange={(e) => setField("holeCloseDelimiter", e.target.value)}
                placeholder="]"
                className={INPUT_CLASS}
              />
            </label>
          </div>
          <label className={`${LABEL_CLASS} mt-4`}>
            <span className="flex items-center justify-between">
              <span>Highlight Translucency</span>
              <span className="tabular-nums font-normal text-neutral-500 dark:text-neutral-400">
                {Math.round(draft.holeHighlightOpacity * 100)}%
              </span>
            </span>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={draft.holeHighlightOpacity}
                onChange={(e) =>
                  onHoleHighlightOpacityChange(Number(e.target.value))
                }
                className="flex-1"
                aria-label="Hole highlight translucency"
              />
              <span
                className="rounded px-2 py-1 text-xs text-neutral-700 dark:text-neutral-300"
                style={{
                  backgroundColor: `rgb(250 204 21 / ${draft.holeHighlightOpacity})`,
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
