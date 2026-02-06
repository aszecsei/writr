"use client";

import { Link2Off } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {currentHref ? "Edit Link" : "Insert Link"}
      </h3>

      <div className="mt-4">
        <label
          htmlFor="link-url"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
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
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <div className="mt-6 flex gap-2">
        {currentHref && (
          <button
            type="button"
            onClick={handleRemove}
            className="flex items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30 dark:focus-visible:ring-offset-zinc-900"
          >
            <Link2Off size={14} />
            Remove
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleClose}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-offset-zinc-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={!url.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-offset-zinc-900"
        >
          Apply
        </button>
      </div>
    </Modal>
  );
}
