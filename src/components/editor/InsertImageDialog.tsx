"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Insert Image
      </h3>

      <div className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="image-url"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
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
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label
            htmlFor="image-alt"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Alt Text (optional)
          </label>
          <input
            id="image-alt"
            type="text"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Description of the image"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={handleClose}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-offset-zinc-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleInsert}
          disabled={!url.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-offset-zinc-900"
        >
          Insert
        </button>
      </div>
    </Modal>
  );
}
