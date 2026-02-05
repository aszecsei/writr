"use client";

import { type ChangeEvent, useCallback, useEffect, useRef } from "react";

interface HeightSyncGroup {
  register: (el: HTMLTextAreaElement) => () => void;
  sync: () => void;
}

export function useHeightSync(): HeightSyncGroup {
  const elements = useRef(new Set<HTMLTextAreaElement>());

  const sync = useCallback(() => {
    const els = [...elements.current];
    if (els.length === 0) return;
    for (const el of els) el.style.height = "auto";
    const max = Math.max(...els.map((el) => el.scrollHeight));
    for (const el of els) el.style.height = `${max}px`;
  }, []);

  const register = useCallback((el: HTMLTextAreaElement) => {
    elements.current.add(el);
    return () => {
      elements.current.delete(el);
    };
  }, []);

  return { register, sync };
}

interface AutoResizeTextareaProps {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  minRows?: number;
  className?: string;
  labelClassName?: string;
  placeholder?: string;
  heightSync?: HeightSyncGroup;
}

export function AutoResizeTextarea({
  label,
  value,
  onChange,
  minRows = 3,
  className,
  labelClassName,
  placeholder,
  heightSync,
}: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Register with height sync group
  useEffect(() => {
    if (!heightSync || !ref.current) return;
    return heightSync.register(ref.current);
  }, [heightSync]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: value triggers resize recalculation on programmatic changes
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (heightSync) {
      heightSync.sync();
    } else {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [value, heightSync]);

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
