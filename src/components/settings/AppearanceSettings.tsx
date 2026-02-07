"use client";

import { Check } from "lucide-react";
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

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

interface AppearanceSettingsProps {
  theme: "light" | "dark" | "system";
  onThemeChange: (theme: "light" | "dark" | "system") => void;
  primaryColor: PrimaryColor;
  onPrimaryColorChange: (color: PrimaryColor) => void;
  neutralColor: NeutralColor;
  onNeutralColorChange: (color: NeutralColor) => void;
  editorWidth: EditorWidth;
  onEditorWidthChange: (width: EditorWidth) => void;
  uiDensity: UiDensity;
  onUiDensityChange: (density: UiDensity) => void;
  inputClass: string;
  labelClass: string;
}

export function AppearanceSettings({
  theme,
  onThemeChange,
  primaryColor,
  onPrimaryColorChange,
  neutralColor,
  onNeutralColorChange,
  editorWidth,
  onEditorWidthChange,
  uiDensity,
  onUiDensityChange,
  inputClass,
  labelClass,
}: AppearanceSettingsProps) {
  return (
    <fieldset>
      <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Appearance
      </legend>
      <div className="mt-3 space-y-5">
        {/* Theme */}
        <label className={labelClass}>
          Theme
          <select
            value={theme}
            onChange={(e) =>
              onThemeChange(e.target.value as "light" | "dark" | "system")
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

        {/* Primary color */}
        <div>
          <span className={labelClass}>Accent Color</span>
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
                    primaryColor === opt.name ? opt.swatch : "transparent",
                  boxShadow:
                    primaryColor === opt.name
                      ? `0 0 0 2px var(--background), 0 0 0 4px ${opt.swatch}`
                      : "none",
                }}
              >
                {primaryColor === opt.name && (
                  <Check size={14} className="text-white" strokeWidth={3} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Neutral color */}
        <div>
          <span className={labelClass}>Chrome Color</span>
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
                    neutralColor === opt.name ? opt.swatch : "transparent",
                  boxShadow:
                    neutralColor === opt.name
                      ? `0 0 0 2px var(--background), 0 0 0 4px ${opt.swatch}`
                      : "none",
                }}
              >
                {neutralColor === opt.name && (
                  <Check size={14} className="text-white" strokeWidth={3} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Editor width */}
        <div>
          <span className={labelClass}>Editor Width</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {EDITOR_WIDTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onEditorWidthChange(opt.value)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  editorWidth === opt.value
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
          <span className={labelClass}>UI Density</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {UI_DENSITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onUiDensityChange(opt.value)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  uiDensity === opt.value
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
