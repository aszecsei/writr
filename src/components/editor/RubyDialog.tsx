"use client";

import { Languages } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { isRubyEditorModal, useUiStore } from "@/store/uiStore";

interface RubyDialogProps {
  onApply: (annotation: string) => void;
  onRemove: () => void;
}

export function RubyDialog({ onApply, onRemove }: RubyDialogProps) {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const [annotation, setAnnotation] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isOpen = isRubyEditorModal(modal);
  const currentAnnotation = isOpen ? modal.currentAnnotation : undefined;

  useEffect(() => {
    if (isOpen) {
      setAnnotation(currentAnnotation ?? "");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, currentAnnotation]);

  const handleClose = useCallback(() => {
    closeModal();
    setAnnotation("");
  }, [closeModal]);

  const handleApply = useCallback(() => {
    if (annotation.trim()) {
      onApply(annotation.trim());
    }
    handleClose();
  }, [annotation, onApply, handleClose]);

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
      <div className="flex items-center gap-2">
        <Languages size={20} className="text-zinc-600 dark:text-zinc-400" />
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {currentAnnotation ? "Edit Ruby Text" : "Insert Ruby Text"}
        </h3>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Add reading guides or annotations above selected text
      </p>

      <div className="mt-4">
        <label
          htmlFor="ruby-annotation"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Annotation
        </label>
        <input
          ref={inputRef}
          id="ruby-annotation"
          type="text"
          value={annotation}
          onChange={(e) => setAnnotation(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g., furigana, pinyin, pronunciation"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <div className="mt-6 flex gap-2">
        {currentAnnotation && (
          <button
            type="button"
            onClick={handleRemove}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30 dark:focus-visible:ring-offset-zinc-900"
          >
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
          disabled={!annotation.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-offset-zinc-900"
        >
          Apply
        </button>
      </div>
    </Modal>
  );
}
