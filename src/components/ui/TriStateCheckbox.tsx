"use client";

import { useEffect, useRef } from "react";

interface TriStateCheckboxProps {
  state: "off" | "on" | "partial";
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  id?: string;
}

/**
 * Checkbox with three rendered states: off, on, partial (HTML's
 * `indeterminate` flag, which can only be set imperatively via a ref).
 * Toggling delegates to the parent — semantics are caller-defined (typically
 * "off/partial → on", "on → off").
 */
export function TriStateCheckbox({
  state,
  onToggle,
  disabled,
  className,
  ariaLabel,
  id,
}: TriStateCheckboxProps) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "partial";
  }, [state]);

  return (
    <input
      ref={ref}
      id={id}
      type="checkbox"
      checked={state === "on"}
      onChange={onToggle}
      disabled={disabled}
      aria-label={ariaLabel}
      className={className}
    />
  );
}
