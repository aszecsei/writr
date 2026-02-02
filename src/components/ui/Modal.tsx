"use client";

import { X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef } from "react";

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  maxWidth?: string;
}

export function Modal({
  children,
  onClose,
  maxWidth = "max-w-md",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      handleClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={handleOverlayClick}
      onKeyDown={(e) => {
        if (e.key === "Escape") handleClose();
      }}
    >
      <div
        ref={panelRef}
        className={`relative w-full ${maxWidth} rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900`}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label="Close dialog"
        >
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}
