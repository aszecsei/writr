"use client";

import type { LucideIcon } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";

type DropdownMenuAlign = "left" | "right" | "full";

const ALIGN_CLASSES: Record<DropdownMenuAlign, string> = {
  left: "left-0",
  right: "right-0",
  full: "left-0 right-0",
};

interface DropdownMenuProps {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  /** Panel alignment relative to the trigger. Defaults to "left". */
  align?: DropdownMenuAlign;
  /**
   * Full appearance for the panel (border, background, rounding, shadow,
   * width, padding, …) — the primitive only supplies positioning.
   */
  panelClassName?: string;
  /** Extra classes merged onto the outer (relatively positioned) wrapper. */
  className?: string;
}

export function DropdownMenu({
  open,
  onClose,
  trigger,
  children,
  align = "left",
  panelClassName,
  className,
}: DropdownMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, onClose, open);

  return (
    <div
      className={`relative${className ? ` ${className}` : ""}`}
      ref={containerRef}
    >
      {trigger}
      {open && (
        <div
          className={`absolute ${ALIGN_CLASSES[align]} top-full z-50 mt-1${
            panelClassName ? ` ${panelClassName}` : ""
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface DropdownMenuItemProps {
  children: ReactNode;
  icon?: LucideIcon;
  active?: boolean;
  onClick: () => void;
}

export function DropdownMenuItem({
  children,
  icon: Icon,
  active = false,
  onClick,
}: DropdownMenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400 ${
        active
          ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
          : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }`}
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}
