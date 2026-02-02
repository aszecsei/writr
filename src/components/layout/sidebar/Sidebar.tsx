"use client";

import type { LucideIcon } from "lucide-react";
import { BookOpen, FileText, Settings } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import { type SidebarPanel, useUiStore } from "@/store/uiStore";
import { BibleNav } from "./BibleNav";
import { ChapterList } from "./ChapterList";
import { SettingsNav } from "./SettingsNav";

const panels: { id: SidebarPanel; label: string; icon: LucideIcon }[] = [
  { id: "chapters", label: "Chapters", icon: FileText },
  { id: "bible", label: "Bible", icon: BookOpen },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const pathname = usePathname();
  const sidebarPanel = useUiStore((s) => s.sidebarPanel);
  const setSidebarPanel = useUiStore((s) => s.setSidebarPanel);

  return (
    <aside className="flex h-full flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <nav className="flex border-b border-zinc-200 dark:border-zinc-800">
        {panels.map((panel) => {
          const Icon = panel.icon;
          return (
            <button
              key={panel.id}
              type="button"
              onClick={() => setSidebarPanel(panel.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
                sidebarPanel === panel.id
                  ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
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
        {sidebarPanel === "settings" && (
          <SettingsNav projectId={projectId} pathname={pathname} />
        )}
      </div>
    </aside>
  );
}
