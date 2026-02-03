"use client";

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

interface AppearanceSettingsProps {
  theme: "light" | "dark" | "system";
  onThemeChange: (theme: "light" | "dark" | "system") => void;
  inputClass: string;
  labelClass: string;
}

export function AppearanceSettings({
  theme,
  onThemeChange,
  inputClass,
  labelClass,
}: AppearanceSettingsProps) {
  return (
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
      </div>
    </fieldset>
  );
}
