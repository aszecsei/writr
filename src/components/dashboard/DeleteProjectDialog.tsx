"use client";

import { AlertTriangle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { deleteProject } from "@/db/operations";
import { useProject } from "@/hooks/useProject";
import { useUiStore } from "@/store/uiStore";

export function DeleteProjectDialog() {
  const activeModal = useUiStore((s) => s.activeModal);
  const modalData = useUiStore((s) => s.modalData);
  const closeModal = useUiStore((s) => s.closeModal);
  const router = useRouter();
  const pathname = usePathname();

  const projectId = modalData.projectId as string | undefined;
  const project = useProject(projectId ?? null);

  const [confirmName, setConfirmName] = useState("");

  if (activeModal !== "delete-project" || !projectId) return null;

  const nameMatches = confirmName === project?.title;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nameMatches || !projectId) return;

    await deleteProject(projectId);
    closeModal();
    setConfirmName("");

    if (pathname.startsWith(`/projects/${projectId}`)) {
      router.push("/");
    }
  }

  function handleClose() {
    setConfirmName("");
    closeModal();
  }

  return (
    <Modal onClose={handleClose}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
          <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Delete Project
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            This will permanently delete{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {project?.title}
            </span>{" "}
            and all its chapters, characters, locations, and other data.
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Type{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {project?.title}
            </span>{" "}
            to confirm
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder={project?.title}
              autoComplete="off"
            />
          </label>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!nameMatches}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-red-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-red-400 dark:bg-red-600 dark:hover:bg-red-700"
          >
            Delete Project
          </button>
        </div>
      </form>
    </Modal>
  );
}
