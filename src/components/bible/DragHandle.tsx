"use client";

import type { ComponentPropsWithRef } from "react";

type DragHandleProps = ComponentPropsWithRef<"button">;

export function DragHandle({ ref, ...props }: DragHandleProps) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label="Drag to reorder"
      className="flex cursor-grab items-center justify-center rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 active:cursor-grabbing dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
      {...props}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="5.5" cy="3.5" r="1.5" />
        <circle cx="10.5" cy="3.5" r="1.5" />
        <circle cx="5.5" cy="8" r="1.5" />
        <circle cx="10.5" cy="8" r="1.5" />
        <circle cx="5.5" cy="12.5" r="1.5" />
        <circle cx="10.5" cy="12.5" r="1.5" />
      </svg>
    </button>
  );
}
