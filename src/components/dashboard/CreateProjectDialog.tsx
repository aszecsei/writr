"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { createProject } from "@/db/operations";
import { useUiStore } from "@/store/uiStore";
import { type ProjectFormData, ProjectFormFields } from "./ProjectFormFields";

const initialValues: ProjectFormData = {
  title: "",
  description: "",
  genre: "",
  targetWordCount: 0,
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
    });

    setValues(initialValues);
    closeModal();
    router.push(`/projects/${project.id}`);
  }

  return (
    <Modal onClose={closeModal}>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        New Project
      </h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <ProjectFormFields values={values} onChange={setValues} />
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={closeModal}
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!values.title.trim()}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-zinc-800 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}
