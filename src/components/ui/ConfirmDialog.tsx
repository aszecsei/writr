"use client";

import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { BUTTON_CANCEL, BUTTON_DANGER, BUTTON_PRIMARY } from "./button-styles";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
  /** Additional action button (e.g., "Delete both") */
  extraAction?: {
    label: string;
    onClick: () => void;
  };
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
  extraAction,
}: ConfirmDialogProps) {
  const isDanger = variant === "danger";

  return (
    <Modal onClose={onCancel} maxWidth="max-w-sm">
      <div className="flex items-start gap-3">
        {isDanger && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {title}
          </h3>
          <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            {message}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {extraAction && (
          <button
            type="button"
            onClick={extraAction.onClick}
            className={`w-full ${BUTTON_DANGER}`}
          >
            {extraAction.label}
          </button>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={`flex-1 ${BUTTON_CANCEL}`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 ${isDanger ? BUTTON_DANGER : BUTTON_PRIMARY}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
