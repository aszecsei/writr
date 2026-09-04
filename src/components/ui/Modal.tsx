"use client";

import { X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef } from "react";

type ModalVariant = "panel" | "bare" | "lightbox";

interface ModalProps {
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  maxWidth?: string;
  /**
   * "panel" (default) is the standard white rounded card. "bare" drops the
   * panel chrome (background, padding, rounding) so the consumer supplies
   * its own panel styling. "lightbox" is the full-bleed dark-overlay look
   * used for image previews.
   */
  variant?: ModalVariant;
}

const OVERLAY_BACKGROUND: Record<ModalVariant, string> = {
  panel: "bg-black/50",
  bare: "bg-black/50",
  lightbox: "bg-black/80",
};

const PANEL_CLASS: Record<ModalVariant, string> = {
  panel: "rounded-xl bg-white p-6 shadow-xl dark:bg-neutral-900",
  bare: "",
  lightbox: "flex flex-col items-center",
};

const CLOSE_BUTTON_CLASS: Record<ModalVariant, string> = {
  panel:
    "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300",
  bare: "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300",
  lightbox: "p-2 text-white/70 hover:text-white",
};

export function Modal({
  title,
  description,
  footer,
  children,
  onClose,
  maxWidth = "max-w-md",
  variant = "panel",
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
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled by the document keydown listener above
    <div
      className={`modal-overlay fixed inset-0 z-50 flex items-center justify-center ${OVERLAY_BACKGROUND[variant]} backdrop-blur-sm`}
      role="dialog"
      aria-modal="true"
      onClick={handleOverlayClick}
    >
      <div
        ref={panelRef}
        className={`modal-panel relative w-full ${maxWidth} max-h-[90vh] overflow-y-auto ${PANEL_CLASS[variant]}`}
      >
        <button
          type="button"
          onClick={handleClose}
          className={`absolute right-4 top-4 rounded-md ${variant === "lightbox" ? "" : "p-1"} transition-colors ${CLOSE_BUTTON_CLASS[variant]}`}
          aria-label="Close dialog"
        >
          <X size={variant === "lightbox" ? 24 : 16} />
        </button>
        {(title || description) && (
          <div className="mb-4">
            {title && (
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {description}
              </p>
            )}
          </div>
        )}
        {children}
        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </div>
  );
}
