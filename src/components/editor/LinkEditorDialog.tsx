"use client";

import { Link2Off } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BUTTON_CANCEL, BUTTON_PRIMARY } from "@/components/ui/button-styles";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import { isLinkEditorModal, useUiStore } from "@/store/uiStore";

interface LinkEditorDialogProps {
  onApply: (href: string) => void;
  onRemove: () => void;
}

export function LinkEditorDialog({ onApply, onRemove }: LinkEditorDialogProps) {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isOpen = isLinkEditorModal(modal);
  const currentHref = isOpen ? modal.currentHref : undefined;

  useEffect(() => {
    if (isOpen) {
      setUrl(currentHref ?? "");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, currentHref]);

  const handleClose = useCallback(() => {
    closeModal();
    setUrl("");
  }, [closeModal]);

  const handleApply = useCallback(() => {
    if (url.trim()) {
      onApply(url.trim());
    }
    handleClose();
  }, [url, onApply, handleClose]);

  const handleRemove = useCallback(() => {
    onRemove();
    handleClose();
  }, [onRemove, handleClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleApply();
      }
    },
    [handleApply],
  );

  if (!isOpen) return null;

  return (
    <Modal onClose={handleClose} maxWidth="max-w-sm">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {currentHref ? "Edit Link" : "Insert Link"}
      </h3>

      <div className="mt-4">
        <label htmlFor="link-url" className={LABEL_CLASS}>
          URL
        </label>
        <input
          ref={inputRef}
          id="link-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://example.com"
          className={INPUT_CLASS}
        />
      </div>

      <div className="mt-6 flex gap-2">
        {currentHref && (
          <button
            type="button"
            onClick={handleRemove}
            className="flex items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30 dark:focus-visible:ring-offset-neutral-900"
          >
            <Link2Off size={14} />
            Remove
          </button>
        )}
        <div className="flex-1" />
        <button type="button" onClick={handleClose} className={BUTTON_CANCEL}>
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={!url.trim()}
          className={BUTTON_PRIMARY}
        >
          Apply
        </button>
      </div>
    </Modal>
  );
}
