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
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
      >
        <Icon size={16} className="text-zinc-400 dark:text-zinc-500" />
        <span className="flex-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </span>
        <ChevronDown
          size={16}
          className={`text-zinc-400 transition-transform dark:text-zinc-500 ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && (
        <div className="border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
          {children}
        </div>
      )}
    </div>
  );
}
