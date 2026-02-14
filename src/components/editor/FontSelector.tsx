"use client";

import { updateAppSettings } from "@/db/operations";
import { EDITOR_FONTS, type EditorFont } from "@/lib/fonts";

const CATEGORY_LABELS: Record<EditorFont["category"], string> = {
  serif: "Serif",
  sans: "Sans-Serif",
  accessible: "Accessible",
  mono: "Monospace",
};

interface FontSelectorProps {
  currentFont: string;
}

export function FontSelector({ currentFont }: FontSelectorProps) {
  async function handleFontChange(e: React.ChangeEvent<HTMLSelectElement>) {
    await updateAppSettings({ editorFont: e.target.value });
  }

  return (
    <label className="flex items-center gap-1">
      <span className="sr-only">Editor font</span>
      <select
        value={currentFont}
        onChange={handleFontChange}
        className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
      >
        {(["serif", "sans", "accessible", "mono"] as const).map((cat) => (
          <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
            {EDITOR_FONTS.filter((f) => f.category === cat).map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
