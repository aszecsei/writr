"use client";

import type { LucideIcon } from "lucide-react";
import { BookOpen, FileText, Settings } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import { MusicControlBar } from "@/components/radio/MusicControlBar";
import { type SidebarPanel, useUiStore } from "@/store/uiStore";
import { BibleNav } from "./BibleNav";
import { ChapterList } from "./ChapterList";

const panels: { id: SidebarPanel; label: string; icon: LucideIcon }[] = [
  { id: "chapters", label: "Chapters", icon: FileText },
  { id: "bible", label: "Bible", icon: BookOpen },
];

export function Sidebar() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const pathname = usePathname();
  const sidebarPanel = useUiStore((s) => s.sidebarPanel);
  const setSidebarPanel = useUiStore((s) => s.setSidebarPanel);
  const openModal = useUiStore((s) => s.openModal);

  return (
    <aside className="flex h-full flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      <nav className="flex border-b border-neutral-200 dark:border-neutral-800">
        {panels.map((panel) => {
          const Icon = panel.icon;
          return (
            <button
              key={panel.id}
              type="button"
              onClick={() => setSidebarPanel(panel.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
                sidebarPanel === panel.id
                  ? "border-b-2 border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400"
                  : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
              }`}
            >
              <Icon size={14} />
              {panel.label}
            </button>
          );
        })}
      </nav>
      <div className="flex-1 overflow-y-auto p-3">
        {sidebarPanel === "chapters" && (
          <ChapterList projectId={projectId} pathname={pathname} />
        )}
        {sidebarPanel === "bible" && (
          <BibleNav projectId={projectId} pathname={pathname} />
        )}
      </div>
      <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
        <MusicControlBar />
        <button
          type="button"
          onClick={() => openModal({ id: "app-settings" })}
          className="flex w-full items-center gap-2 rounded-md px-3 py-density-item text-left text-sm text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
        >
          <Settings size={14} />
          App Settings
        </button>
      </div>
    </aside>
  );
}
