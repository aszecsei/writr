"use client";

import { type ChangeEvent, useEffect, useRef } from "react";

interface AutoResizeTextareaProps {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  minRows?: number;
  className?: string;
  labelClassName?: string;
  placeholder?: string;
}

export function AutoResizeTextarea({
  label,
  value,
  onChange,
  minRows = 3,
  className,
  labelClassName,
  placeholder,
}: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: value triggers resize recalculation on programmatic changes
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <label className={labelClassName}>
      {label}
      <textarea
        ref={ref}
        rows={minRows}
        value={value}
        onChange={onChange}
        className={`resize-none overflow-hidden ${className ?? ""}`}
        placeholder={placeholder}
      />
    </label>
  );
}
