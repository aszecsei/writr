"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BUTTON_CANCEL, BUTTON_PRIMARY } from "@/components/ui/button-styles";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import { useUiStore } from "@/store/uiStore";

interface InsertImageDialogProps {
  onInsert: (src: string, alt: string) => void;
}

export function InsertImageDialog({ onInsert }: InsertImageDialogProps) {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isOpen = modal.id === "insert-image";

  useEffect(() => {
    if (isOpen) {
      setUrl("");
      setAlt("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    closeModal();
    setUrl("");
    setAlt("");
  }, [closeModal]);

  const handleInsert = useCallback(() => {
    if (url.trim()) {
      onInsert(url.trim(), alt.trim());
    }
    handleClose();
  }, [url, alt, onInsert, handleClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleInsert();
      }
    },
    [handleInsert],
  );

  if (!isOpen) return null;

  return (
    <Modal onClose={handleClose} maxWidth="max-w-sm">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Insert Image
      </h3>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="image-url" className={LABEL_CLASS}>
            Image URL
          </label>
          <input
            ref={inputRef}
            id="image-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://example.com/image.jpg"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="image-alt" className={LABEL_CLASS}>
            Alt Text (optional)
          </label>
          <input
            id="image-alt"
            type="text"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Description of the image"
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={handleClose} className={BUTTON_CANCEL}>
          Cancel
        </button>
        <button
          type="button"
          onClick={handleInsert}
          disabled={!url.trim()}
          className={BUTTON_PRIMARY}
        >
          Insert
        </button>
      </div>
    </Modal>
  );
}
