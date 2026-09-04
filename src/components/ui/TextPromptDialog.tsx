"use client";

import type { LucideIcon } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { BUTTON_CANCEL, BUTTON_PRIMARY } from "@/components/ui/button-styles";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";

export interface TextPromptField {
  /** Also used as the input's DOM id and the key in `initialValues`/`onApply`'s values. */
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
}

interface TextPromptDialogProps {
  isOpen: boolean;
  title: ReactNode;
  description?: ReactNode;
  /** Icon shown next to the title. */
  icon?: LucideIcon;
  fields: TextPromptField[];
  initialValues: Record<string, string>;
  onClose: () => void;
  /** Called with the trimmed value of each field, keyed by field id. */
  onApply: (values: Record<string, string>) => void;
  onRemove?: () => void;
  /** Whether the Remove button should be shown (only relevant when `onRemove` is set). */
  canRemove?: boolean;
  removeIcon?: LucideIcon;
  applyLabel?: string;
  removeLabel?: string;
  maxWidth?: string;
}

export function TextPromptDialog({
  isOpen,
  title,
  description,
  icon: Icon,
  fields,
  initialValues,
  onClose,
  onApply,
  onRemove,
  canRemove = false,
  removeIcon: RemoveIcon,
  applyLabel = "Apply",
  removeLabel = "Remove",
  maxWidth = "max-w-sm",
}: TextPromptDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues);
      setTimeout(() => firstInputRef.current?.focus(), 0);
    }
  }, [isOpen, initialValues]);

  const handleClose = useCallback(() => {
    onClose();
    setValues({});
  }, [onClose]);

  const primaryFieldId = fields[0]?.id;
  const isValid = primaryFieldId
    ? (values[primaryFieldId] ?? "").trim().length > 0
    : false;

  const handleApply = useCallback(() => {
    if (isValid) {
      const trimmed = Object.fromEntries(
        fields.map((field) => [field.id, (values[field.id] ?? "").trim()]),
      );
      onApply(trimmed);
    }
    handleClose();
  }, [isValid, fields, values, onApply, handleClose]);

  const handleRemove = useCallback(() => {
    onRemove?.();
    handleClose();
  }, [onRemove, handleClose]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleApply();
      }
    },
    [handleApply],
  );

  if (!isOpen) return null;

  const modalTitle = Icon ? (
    <span className="inline-flex items-center gap-2">
      <Icon size={20} className="text-neutral-600 dark:text-neutral-400" />
      {title}
    </span>
  ) : (
    title
  );

  return (
    <Modal
      onClose={handleClose}
      maxWidth={maxWidth}
      title={modalTitle}
      description={description}
    >
      <div className={fields.length > 1 ? "mt-4 space-y-4" : "mt-4"}>
        {fields.map((field, index) => (
          <div key={field.id}>
            <label htmlFor={field.id} className={LABEL_CLASS}>
              {field.label}
            </label>
            <input
              ref={index === 0 ? firstInputRef : undefined}
              id={field.id}
              type={field.type ?? "text"}
              value={values[field.id] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [field.id]: e.target.value }))
              }
              onKeyDown={handleKeyDown}
              placeholder={field.placeholder}
              className={INPUT_CLASS}
            />
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-2">
        {onRemove && canRemove && (
          <button
            type="button"
            onClick={handleRemove}
            className={`rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30 dark:focus-visible:ring-offset-neutral-900${
              RemoveIcon ? " flex items-center gap-1.5" : ""
            }`}
          >
            {RemoveIcon && <RemoveIcon size={14} />}
            {removeLabel}
          </button>
        )}
        <div className="flex-1" />
        <button type="button" onClick={handleClose} className={BUTTON_CANCEL}>
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={!isValid}
          className={BUTTON_PRIMARY}
        >
          {applyLabel}
        </button>
      </div>
    </Modal>
  );
}
