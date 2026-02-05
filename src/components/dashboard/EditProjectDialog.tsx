"use client";

import { type FormEvent, useEffect, useState } from "react";
import { BUTTON_CANCEL, BUTTON_PRIMARY } from "@/components/ui/button-styles";
import { Modal } from "@/components/ui/Modal";
import { updateProject } from "@/db/operations";
import { useProject } from "@/hooks/useProject";
import { isEditProjectModal, useUiStore } from "@/store/uiStore";
import { type ProjectFormData, ProjectFormFields } from "./ProjectFormFields";

const initialValues: ProjectFormData = {
  title: "",
  description: "",
  genre: "",
  targetWordCount: 0,
};

export function EditProjectDialog() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);

  const projectId = isEditProjectModal(modal) ? modal.projectId : null;
  const project = useProject(projectId);

  const [values, setValues] = useState<ProjectFormData>(initialValues);

  useEffect(() => {
    if (project) {
      setValues({
        title: project.title,
        description: project.description,
        genre: project.genre,
        targetWordCount: project.targetWordCount,
      });
    }
  }, [project]);

  if (!isEditProjectModal(modal)) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.title.trim() || !projectId) return;

    await updateProject(projectId, {
      title: values.title.trim(),
      description: values.description.trim(),
      genre: values.genre.trim(),
      targetWordCount: Math.max(0, values.targetWordCount),
    });

    closeModal();
  }

  return (
    <Modal onClose={closeModal}>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Edit Project
      </h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <ProjectFormFields values={values} onChange={setValues} />
        <div className="flex justify-end gap-3">
          <button type="button" onClick={closeModal} className={BUTTON_CANCEL}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!values.title.trim()}
            className={BUTTON_PRIMARY}
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
