"use client";

import { Lightbulb, Pencil, Plus, Settings, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CreateProjectDialog } from "@/components/dashboard/CreateProjectDialog";
import { DeleteProjectDialog } from "@/components/dashboard/DeleteProjectDialog";
import { EditProjectDialog } from "@/components/dashboard/EditProjectDialog";
import { ProjectGrid } from "@/components/dashboard/ProjectGrid";
import { BUTTON_PRIMARY } from "@/components/ui/button-styles";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/ContextMenu";
import { Spinner } from "@/components/ui/Spinner";
import type { ProjectId } from "@/db/schemas";
import { useAllProjects } from "@/hooks/data/useProject";
import { useUiStore } from "@/store/uiStore";

export default function DashboardPage() {
  const projects = useAllProjects();
  const openModal = useUiStore((s) => s.openModal);

  const [menuProjectId, setMenuProjectId] = useState<ProjectId | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  function handleContextMenu(e: React.MouseEvent, projectId: ProjectId) {
    e.preventDefault();
    setMenuProjectId(projectId);
    setMenuPos({ x: e.clientX, y: e.clientY });
  }

  function closeMenu() {
    setMenuProjectId(null);
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:border-neutral-800/80 dark:bg-neutral-900/80 dark:supports-[backdrop-filter]:bg-neutral-900/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1
            className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
            style={{ fontFamily: "var(--font-literata), Georgia, serif" }}
          >
            writr
          </h1>
          <div className="flex items-center gap-2">
            <Link
              href="/brainstorm"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            >
              <Lightbulb size={16} />
              Brainstorm
            </Link>
            <button
              type="button"
              onClick={() => openModal({ id: "app-settings" })}
              className="flex items-center justify-center rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              aria-label="App Settings"
            >
              <Settings size={18} />
            </button>
            <button
              type="button"
              onClick={() => openModal({ id: "create-project" })}
              className={`flex items-center gap-2 ${BUTTON_PRIMARY}`}
            >
              <Plus size={16} />
              New Project
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        {projects === undefined ? (
          <div className="flex justify-center py-24">
            <Spinner />
          </div>
        ) : (
          <>
            {projects.length > 0 && (
              <div className="mb-5 flex items-baseline justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">
                  Projects
                </h2>
                <span className="text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
                  {projects.length}{" "}
                  {projects.length === 1 ? "project" : "projects"}
                </span>
              </div>
            )}
            <ProjectGrid
              projects={projects}
              onContextMenu={handleContextMenu}
              onCreateProject={() => openModal({ id: "create-project" })}
            />
          </>
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
