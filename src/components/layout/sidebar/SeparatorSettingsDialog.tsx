"use client";

import { useEffect, useRef, useState } from "react";
import { DialogFooter } from "@/components/ui/DialogFooter";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import { updateSeparator } from "@/db/operations";
import type { ChapterId } from "@/db/schemas";
import { useChapter } from "@/hooks/data/useChapter";
import { isSeparatorSettingsModal, useUiStore } from "@/store/uiStore";

export function SeparatorSettingsDialog() {
  const modal = useUiStore((s) => s.modal);
  if (!isSeparatorSettingsModal(modal)) return null;
  return <SeparatorSettingsDialogInner chapterId={modal.chapterId} />;
}

function SeparatorSettingsDialogInner({ chapterId }: { chapterId: ChapterId }) {
  const separator = useChapter(chapterId);
  const closeModal = useUiStore((s) => s.closeModal);

  const [title, setTitle] = useState("");
  const [includeInCompile, setIncludeInCompile] = useState(true);
  const [pageBreakBefore, setPageBreakBefore] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (separator && !initialized.current) {
      setTitle(separator.title);
      setIncludeInCompile(separator.includeInCompile);
      setPageBreakBefore(separator.pageBreakBefore);
      initialized.current = true;
    }
  }, [separator]);

  async function handleSave() {
    await updateSeparator(chapterId, {
      title: title.trim() || "Section",
      includeInCompile,
      pageBreakBefore,
    });
    closeModal();
  }

  return (
    <Modal onClose={closeModal} maxWidth="max-w-md" title="Separator">
      <label className={LABEL_CLASS} htmlFor="separator-label">
        Label
      </label>
      <input
        id="separator-label"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Part One"
        className={INPUT_CLASS}
      />

      <div className="mt-4 space-y-3">
        <label className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={includeInCompile}
            onChange={(e) => setIncludeInCompile(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
          />
          <span>
            Include in compiled output
            <span className="block text-xs text-neutral-500 dark:text-neutral-400">
              Print this label as a heading when exporting the book.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={pageBreakBefore}
            disabled={!includeInCompile}
            onChange={(e) => setPageBreakBefore(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 disabled:opacity-50 dark:border-neutral-600"
          />
          <span className={includeInCompile ? "" : "opacity-50"}>
            Page break before
            <span className="block text-xs text-neutral-500 dark:text-neutral-400">
              Start a new page at this separator in the export.
            </span>
          </span>
        </label>
      </div>

      <div className="mt-6">
        <DialogFooter
          onCancel={closeModal}
          submitLabel="Save"
          submitType="button"
          onSubmit={handleSave}
        />
      </div>
    </Modal>
  );
}
