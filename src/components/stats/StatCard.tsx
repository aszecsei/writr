"use client";

import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  subtitle,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 transition-all duration-150 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
        <Icon size={16} />
      </div>
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        {value}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
          {subtitle}
        </p>
      )}
    </div>
  );
}
