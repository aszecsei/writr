"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";

interface CollapsibleSectionProps {
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
      >
        <Icon size={16} className="text-neutral-400 dark:text-neutral-500" />
        <span className="flex-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {title}
        </span>
        <ChevronDown
          size={16}
          className={`text-neutral-400 transition-transform dark:text-neutral-500 ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && (
        <div className="border-t border-neutral-200 px-4 py-4 dark:border-neutral-800">
          {children}
        </div>
      )}
    </div>
  );
}
