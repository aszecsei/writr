"use client";

import { Pencil, Plus, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import { CreateProjectDialog } from "@/components/dashboard/CreateProjectDialog";
import { DeleteProjectDialog } from "@/components/dashboard/DeleteProjectDialog";
import { EditProjectDialog } from "@/components/dashboard/EditProjectDialog";
import { ProjectGrid } from "@/components/dashboard/ProjectGrid";
import { AppSettingsDialog } from "@/components/settings/AppSettingsDialog";
import { DictionaryManagerDialog } from "@/components/settings/DictionaryManagerDialog";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/ContextMenu";
import { useAllProjects } from "@/hooks/useProject";
import { useUiStore } from "@/store/uiStore";

export default function DashboardPage() {
  const projects = useAllProjects();
  const openModal = useUiStore((s) => s.openModal);

  const [menuProjectId, setMenuProjectId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  function handleContextMenu(e: React.MouseEvent, projectId: string) {
    e.preventDefault();
    setMenuProjectId(projectId);
    setMenuPos({ x: e.clientX, y: e.clientY });
  }

  function closeMenu() {
    setMenuProjectId(null);
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            writr
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openModal({ id: "app-settings" })}
              className="flex items-center justify-center rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              aria-label="App Settings"
            >
              <Settings size={18} />
            </button>
            <button
              type="button"
              onClick={() => openModal({ id: "create-project" })}
              className="flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-400 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
            >
              <Plus size={16} />
              New Project
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        {projects === undefined ? (
          <div className="flex justify-center py-24">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-600 dark:border-neutral-700 dark:border-t-primary-400" />
          </div>
        ) : (
          <ProjectGrid projects={projects} onContextMenu={handleContextMenu} />
        )}
      </main>

      {menuProjectId && (
        <ContextMenu position={menuPos} onClose={closeMenu}>
          <ContextMenuItem
            icon={Pencil}
            onClick={() => {
              closeMenu();
              openModal({ id: "edit-project", projectId: menuProjectId });
            }}
          >
            Edit
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            icon={Trash2}
            variant="danger"
            onClick={() => {
              closeMenu();
              openModal({ id: "delete-project", projectId: menuProjectId });
            }}
          >
            Delete
          </ContextMenuItem>
        </ContextMenu>
      )}

      <CreateProjectDialog />
      <EditProjectDialog />
      <DeleteProjectDialog />
      <AppSettingsDialog />
      <DictionaryManagerDialog />
    </div>
  );
}
