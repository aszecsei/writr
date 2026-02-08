"use client";

import {
  type ChangeEvent,
  type KeyboardEventHandler,
  useCallback,
  useEffect,
  useRef,
} from "react";

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
  label?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  minRows?: number;
  maxRows?: number;
  className?: string;
  labelClassName?: string;
  placeholder?: string;
  disabled?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
  heightSync?: HeightSyncGroup;
}

export function AutoResizeTextarea({
  label,
  value,
  onChange,
  minRows = 3,
  maxRows,
  className,
  labelClassName,
  placeholder,
  disabled,
  onKeyDown,
  heightSync,
}: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const overflowing = useRef(false);

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
      const scrollHeight = el.scrollHeight;

      if (maxRows) {
        const lineHeight =
          Number.parseInt(getComputedStyle(el).lineHeight, 10) ||
          Math.round(scrollHeight / Math.max(el.rows, 1));
        const maxHeight = lineHeight * maxRows;
        if (scrollHeight > maxHeight) {
          el.style.height = `${maxHeight}px`;
          overflowing.current = true;
        } else {
          el.style.height = `${scrollHeight}px`;
          overflowing.current = false;
        }
      } else {
        el.style.height = `${scrollHeight}px`;
        overflowing.current = false;
      }
      el.style.overflowY = overflowing.current ? "auto" : "hidden";
    }
  }, [value, heightSync, maxRows]);

  const textarea = (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={onChange}
      className={`resize-none overflow-hidden ${className ?? ""}`}
      placeholder={placeholder}
      disabled={disabled}
      onKeyDown={onKeyDown}
    />
  );

  if (!label) return textarea;

  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: textarea is passed as child via variable
    <label className={labelClassName}>
      {label}
      {textarea}
    </label>
  );
}
