"use client";

import { Check } from "lucide-react";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";
import type {
  EditorWidth,
  NeutralColor,
  PrimaryColor,
  UiDensity,
} from "@/db/schemas";
import {
  EDITOR_WIDTH_OPTIONS,
  NEUTRAL_OPTIONS,
  PRIMARY_OPTIONS,
  UI_DENSITY_OPTIONS,
} from "@/lib/theme/palettes";
import type {
  AppSettingsDraft,
  SetAppSettingsField,
} from "./AppSettingsDialog";

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

interface AppearanceSettingsProps {
  draft: AppSettingsDraft;
  setField: SetAppSettingsField;
  onPrimaryColorChange: (color: PrimaryColor) => void;
  onNeutralColorChange: (color: NeutralColor) => void;
  onEditorWidthChange: (width: EditorWidth) => void;
  onUiDensityChange: (density: UiDensity) => void;
}

export function AppearanceSettings({
  draft,
  setField,
  onPrimaryColorChange,
  onNeutralColorChange,
  onEditorWidthChange,
  onUiDensityChange,
}: AppearanceSettingsProps) {
  return (
    <fieldset>
      <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Appearance
      </legend>
      <div className="mt-3 space-y-5">
        {/* Theme */}
        <label className={LABEL_CLASS}>
          Theme
          <select
            value={draft.theme}
            onChange={(e) =>
              setField("theme", e.target.value as "light" | "dark" | "system")
            }
            className={INPUT_CLASS}
          >
            {THEME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {/* Primary color */}
        <div>
          <span className={LABEL_CLASS}>Accent Color</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRIMARY_OPTIONS.map((opt) => (
              <button
                key={opt.name}
                type="button"
                title={opt.label}
                onClick={() => onPrimaryColorChange(opt.name)}
                className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all"
                style={{
                  backgroundColor: opt.swatch,
                  borderColor:
                    draft.primaryColor === opt.name
                      ? opt.swatch
                      : "transparent",
                  boxShadow:
                    draft.primaryColor === opt.name
                      ? `0 0 0 2px var(--background), 0 0 0 4px ${opt.swatch}`
                      : "none",
                }}
              >
                {draft.primaryColor === opt.name && (
                  <Check size={14} className="text-white" strokeWidth={3} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Neutral color */}
        <div>
          <span className={LABEL_CLASS}>Chrome Color</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {NEUTRAL_OPTIONS.map((opt) => (
              <button
                key={opt.name}
                type="button"
                title={opt.label}
                onClick={() => onNeutralColorChange(opt.name)}
                className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all"
                style={{
                  backgroundColor: opt.swatch,
                  borderColor:
                    draft.neutralColor === opt.name
                      ? opt.swatch
                      : "transparent",
                  boxShadow:
                    draft.neutralColor === opt.name
                      ? `0 0 0 2px var(--background), 0 0 0 4px ${opt.swatch}`
                      : "none",
                }}
              >
                {draft.neutralColor === opt.name && (
                  <Check size={14} className="text-white" strokeWidth={3} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Editor width */}
        <div>
          <span className={LABEL_CLASS}>Editor Width</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {EDITOR_WIDTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onEditorWidthChange(opt.value)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  draft.editorWidth === opt.value
                    ? "border-primary-600 bg-primary-600 text-white dark:border-primary-500 dark:bg-primary-500"
                    : "border-neutral-200 text-neutral-700 hover:border-neutral-300 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* UI density */}
        <div>
          <span className={LABEL_CLASS}>UI Density</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {UI_DENSITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onUiDensityChange(opt.value)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  draft.uiDensity === opt.value
                    ? "border-primary-600 bg-primary-600 text-white dark:border-primary-500 dark:bg-primary-500"
                    : "border-neutral-200 text-neutral-700 hover:border-neutral-300 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </fieldset>
  );
}
