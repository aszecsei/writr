"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { CreateProjectDialog } from "@/components/dashboard/CreateProjectDialog";
import { DeleteProjectDialog } from "@/components/dashboard/DeleteProjectDialog";
import { EditProjectDialog } from "@/components/dashboard/EditProjectDialog";
import { ProjectGrid } from "@/components/dashboard/ProjectGrid";
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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            writr
          </h1>
          <button
            type="button"
            onClick={() => openModal({ id: "create-project" })}
            className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Plus size={16} />
            New Project
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        {projects === undefined ? (
          <div className="flex justify-center py-24">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
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
    </div>
  );
}
