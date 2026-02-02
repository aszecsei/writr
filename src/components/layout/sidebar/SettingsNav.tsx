"use client";

import { FolderOpen, Settings } from "lucide-react";
import Link from "next/link";
import { useUiStore } from "@/store/uiStore";

export function SettingsNav({
  projectId,
  pathname,
}: {
  projectId: string;
  pathname: string;
}) {
  const openModal = useUiStore((s) => s.openModal);

  return (
    <div className="space-y-1">
      <Link
        href={`/projects/${projectId}`}
        className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
          pathname === `/projects/${projectId}`
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
        }`}
      >
        <FolderOpen size={14} />
        Project Overview
      </Link>
      <button
        type="button"
        onClick={() => openModal("app-settings")}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
      >
        <Settings size={14} />
        App Settings
      </button>
    </div>
  );
}
