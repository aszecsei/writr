"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { DialogFooter } from "@/components/ui/DialogFooter";
import { Modal } from "@/components/ui/Modal";
import { createProject } from "@/db/operations";
import { useUiStore } from "@/store/uiStore";
import { type ProjectFormData, ProjectFormFields } from "./ProjectFormFields";

const initialValues: ProjectFormData = {
  title: "",
  description: "",
  genre: "",
  targetWordCount: 0,
  mode: "prose",
};

export function CreateProjectDialog() {
  const router = useRouter();
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const [values, setValues] = useState<ProjectFormData>(initialValues);

  if (modal.id !== "create-project") return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.title.trim()) return;

    const project = await createProject({
      title: values.title.trim(),
      description: values.description.trim(),
      genre: values.genre.trim(),
      targetWordCount: Math.max(0, values.targetWordCount),
      mode: values.mode,
    });

    setValues(initialValues);
    closeModal();
    router.push(`/projects/${project.id}`);
  }

  return (
    <Modal onClose={closeModal}>
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        New Project
      </h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <ProjectFormFields values={values} onChange={setValues} />
        <DialogFooter
          onCancel={closeModal}
          submitLabel="Create"
          submitDisabled={!values.title.trim()}
        />
      </form>
    </Modal>
  );
}
