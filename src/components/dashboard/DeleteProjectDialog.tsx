"use client";

import { AlertTriangle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { DialogFooter } from "@/components/ui/DialogFooter";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import { deleteProject } from "@/db/operations";
import { useProject } from "@/hooks/useProject";
import { isDeleteProjectModal, useUiStore } from "@/store/uiStore";

export function DeleteProjectDialog() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const router = useRouter();
  const pathname = usePathname();

  const projectId = isDeleteProjectModal(modal) ? modal.projectId : undefined;
  const project = useProject(projectId ?? null);

  const [confirmName, setConfirmName] = useState("");

  if (!isDeleteProjectModal(modal)) return null;

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
          <label className={LABEL_CLASS}>
            Type{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {project?.title}
            </span>{" "}
            to confirm
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className={INPUT_CLASS}
              placeholder={project?.title}
              autoComplete="off"
            />
          </label>
        </div>
        <DialogFooter
          onCancel={handleClose}
          submitLabel="Delete Project"
          submitDisabled={!nameMatches}
          variant="danger"
        />
      </form>
    </Modal>
  );
}
