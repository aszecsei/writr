"use client";

import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import type { ProjectId } from "@/db/schemas";
import { BIBLE_SECTIONS } from "@/lib/bible-sections";

export function BibleNav({
  projectId,
  pathname,
}: {
  projectId: ProjectId;
  pathname: string;
}) {
  return (
    <div className="space-y-1">
      <Link
        href={`/projects/${projectId}/bible`}
        className={`flex items-center gap-2 rounded-md px-3 py-density-item text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
          pathname === `/projects/${projectId}/bible`
            ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
        }`}
      >
        <LayoutGrid size={14} />
        Overview
      </Link>
      {BIBLE_SECTIONS.map((section) => {
        const href = `/projects/${projectId}/${section.path}`;
        const isActive = pathname.startsWith(href);
        const Icon = section.icon;
        return (
          <Link
            key={section.path}
            href={href}
            className={`flex items-center gap-2 rounded-md px-3 py-density-item text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
              isActive
                ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
            }`}
          >
            <Icon size={14} />
            {section.label}
          </Link>
        );
      })}
    </div>
  );
}
