"use client";

import {
  type ChangeEvent,
  type FocusEventHandler,
  type KeyboardEventHandler,
  useCallback,
  useEffect,
  useRef,
} from "react";

interface HeightSyncGroup {
  register: (el: HTMLTextAreaElement) => () => void;
  sync: () => void;
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
  onBlur?: FocusEventHandler<HTMLTextAreaElement>;
  heightSync?: HeightSyncGroup;
  autoFocus?: boolean;
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
  onBlur,
  heightSync,
  autoFocus,
}: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const overflowing = useRef(false);
  const lastWidth = useRef(0);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (heightSync) {
      heightSync.sync();
      return;
    }
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
  }, [heightSync, maxRows]);

  // Register with height sync group
  useEffect(() => {
    if (!heightSync || !ref.current) return;
    return heightSync.register(ref.current);
  }, [heightSync]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: value triggers resize recalculation on programmatic changes
  useEffect(() => {
    resize();
  }, [value, resize]);

  // Re-measure when the textarea's width changes. Measuring `scrollHeight`
  // only at mount is unreliable when the element isn't laid out at its final
  // width yet (e.g. mounted inside a resizable panel that starts near 0 width,
  // where an empty placeholder wraps and inflates scrollHeight to maxRows).
  // Recalculate only on width changes to avoid a feedback loop from our own
  // height writes.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width === lastWidth.current) return;
      lastWidth.current = width;
      resize();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [resize]);

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
      onBlur={onBlur}
      // biome-ignore lint/a11y/noAutofocus: opt-in, used only when a field toggles into edit mode
      autoFocus={autoFocus}
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
