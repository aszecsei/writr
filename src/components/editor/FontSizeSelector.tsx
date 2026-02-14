"use client";

import { updateAppSettings } from "@/db/operations";

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32];

interface FontSizeSelectorProps {
  currentFontSize: number;
}

export function FontSizeSelector({ currentFontSize }: FontSizeSelectorProps) {
  async function handleFontSizeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    await updateAppSettings({ editorFontSize: Number(e.target.value) });
  }

  return (
    <label className="flex items-center gap-1">
      <span className="sr-only">Font size</span>
      <select
        value={currentFontSize}
        onChange={handleFontSizeChange}
        className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
      >
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}px
          </option>
        ))}
      </select>
    </label>
  );
}
