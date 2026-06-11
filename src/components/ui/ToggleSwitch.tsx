"use client";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible text label rendered beside the pill. */
  label: string;
  /** Smaller caption rendered under the label. */
  caption?: string;
  disabled?: boolean;
}

/** Pill-style on/off switch with a visible label. */
export function ToggleSwitch({
  checked,
  onChange,
  label,
  caption,
  disabled = false,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
          {label}
        </span>
        {caption && (
          <span className="block text-[11px] text-neutral-400 dark:text-neutral-500">
            {caption}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
          checked
            ? "bg-primary-600 dark:bg-primary-500"
            : "bg-neutral-300 dark:bg-neutral-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
            checked ? "translate-x-3" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
