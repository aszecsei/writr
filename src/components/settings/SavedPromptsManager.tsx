"use client";

import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { BUTTON_PRIMARY } from "@/components/ui/button-styles";
import { CloseFooter } from "@/components/ui/CloseFooter";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DialogFooter } from "@/components/ui/DialogFooter";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import {
  createSavedPrompt,
  deleteSavedPrompt,
  resetSavedPromptToDefault,
  updateSavedPrompt,
} from "@/db/operations/savedPrompts";
import type { SavedPrompt, SavedPromptId } from "@/db/schemas";
import { useActiveProject } from "@/hooks/data/useProject";
import { useAvailableSavedPrompts } from "@/hooks/data/useSavedPrompts";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";

type Scope = "project" | "global";

// Sentinel for "the inline form is creating a new prompt" (vs. editing an
// existing row by its id).
const NEW = "new" as const;

export function SavedPromptsManager() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProjectTitle = useActiveProject()?.title ?? null;

  const prompts = useAvailableSavedPrompts(activeProjectId);

  const [editing, setEditing] = useState<SavedPromptId | typeof NEW | null>(
    null,
  );
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftScope, setDraftScope] = useState<Scope>("global");
  const [confirmDelete, setConfirmDelete] = useState<SavedPromptId | null>(
    null,
  );
  const [confirmReset, setConfirmReset] = useState<SavedPromptId | null>(null);

  if (modal.id !== "saved-prompts") return null;

  function startCreate() {
    setEditing(NEW);
    setDraftTitle("");
    setDraftBody("");
    setDraftScope(activeProjectId ? "project" : "global");
  }

  function startEdit(prompt: SavedPrompt) {
    setEditing(prompt.id);
    setDraftTitle(prompt.title);
    setDraftBody(prompt.body);
    setDraftScope(prompt.projectId === null ? "global" : "project");
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function handleSave() {
    const title = draftTitle.trim();
    if (!title) return;
    const projectId = draftScope === "project" ? activeProjectId : null;
    if (editing === NEW) {
      await createSavedPrompt({ title, body: draftBody, projectId });
    } else if (editing) {
      await updateSavedPrompt(editing, { title, body: draftBody, projectId });
    }
    setEditing(null);
  }

  const canSave = draftTitle.trim().length > 0;

  function renderForm() {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/50"
      >
        <label className={LABEL_CLASS}>
          Title
          <input
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            required
            placeholder="e.g. Tighten this scene"
            className={INPUT_CLASS}
          />
        </label>
        <AutoResizeTextarea
          label="Prompt"
          labelClassName={LABEL_CLASS}
          value={draftBody}
          onChange={(e) => setDraftBody(e.target.value)}
          minRows={3}
          maxRows={12}
          placeholder="The reusable prompt text inserted into the chat input."
          className={INPUT_CLASS}
        />
        {activeProjectId && (
          <label className={LABEL_CLASS}>
            Scope
            <select
              value={draftScope}
              onChange={(e) => setDraftScope(e.target.value as Scope)}
              className={INPUT_CLASS}
            >
              <option value="project">
                {activeProjectTitle ?? "This project"} only
              </option>
              <option value="global">Global (all projects)</option>
            </select>
          </label>
        )}
        <DialogFooter
          onCancel={cancelEdit}
          submitLabel={editing === NEW ? "Create" : "Save"}
          submitDisabled={!canSave}
        />
      </form>
    );
  }

  return (
    <Modal onClose={closeModal} maxWidth="max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Saved Prompts
          </h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Reusable prompts you can drop into the chat input. Global prompts
            appear in every project; project prompts only here.
          </p>
        </div>
        {editing !== NEW && (
          <button
            type="button"
            onClick={startCreate}
            className={`${BUTTON_PRIMARY} inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap`}
          >
            <Plus size={14} />
            New
          </button>
        )}
      </div>

      {editing === NEW && <div className="mt-4">{renderForm()}</div>}

      <div className="mt-4 space-y-2">
        {prompts && prompts.length === 0 && editing !== NEW && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No saved prompts yet. Click “New” to create one.
          </p>
        )}
        {prompts?.map((p) =>
          editing === p.id ? (
            <div key={p.id}>{renderForm()}</div>
          ) : (
            <SavedPromptRow
              key={p.id}
              prompt={p}
              onEdit={() => startEdit(p)}
              onDelete={() => setConfirmDelete(p.id)}
              onReset={() => setConfirmReset(p.id)}
            />
          ),
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this prompt?"
          message="This permanently removes the saved prompt."
          variant="danger"
          confirmLabel="Delete"
          onConfirm={async () => {
            await deleteSavedPrompt(confirmDelete);
            if (editing === confirmDelete) setEditing(null);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {confirmReset && (
        <ConfirmDialog
          title="Reset this prompt?"
          message="This restores the built-in prompt's title and body to their bundled defaults, discarding your edits."
          confirmLabel="Reset"
          onConfirm={async () => {
            await resetSavedPromptToDefault(confirmReset);
            if (editing === confirmReset) setEditing(null);
            setConfirmReset(null);
          }}
          onCancel={() => setConfirmReset(null)}
        />
      )}

      <div className="mt-4">
        <CloseFooter onClose={closeModal} />
      </div>
    </Modal>
  );
}

interface SavedPromptRowProps {
  prompt: SavedPrompt;
  onEdit: () => void;
  onDelete: () => void;
  onReset: () => void;
}

function SavedPromptRow({
  prompt,
  onEdit,
  onDelete,
  onReset,
}: SavedPromptRowProps) {
  const isGlobal = prompt.projectId === null;
  const isBuiltin = prompt.builtinKey !== null;
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {prompt.title}
            </span>
            {isBuiltin && (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                Built-in
              </span>
            )}
            {isGlobal && !isBuiltin && (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                Global
              </span>
            )}
          </div>
          {prompt.body && (
            <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
              {prompt.body}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            title="Edit"
            className="rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <Pencil size={14} />
          </button>
          {isBuiltin ? (
            // Built-in prompts can't be deleted — only reset to their default.
            <button
              type="button"
              onClick={onReset}
              title="Reset to default"
              className="rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            >
              <RotateCcw size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onDelete}
              title="Delete"
              className="rounded p-1 text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-neutral-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
