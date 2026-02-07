import type { ReactNode } from "react";
import { BUTTON_CANCEL, BUTTON_DANGER, BUTTON_PRIMARY } from "./button-styles";

interface DialogFooterProps {
  onCancel: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  variant?: "primary" | "danger";
  /** Optional left-side content (e.g., a "View History" button) */
  left?: ReactNode;
  /** Optional extra classes on the submit button (e.g., "flex items-center gap-2") */
  submitClassName?: string;
  /** If provided, renders custom children instead of the default submit button */
  submitChildren?: ReactNode;
  /** Submit button type — defaults to "submit" */
  submitType?: "submit" | "button";
  /** Click handler for button-type submits */
  onSubmit?: () => void;
}

export function DialogFooter({
  onCancel,
  submitLabel = "Save",
  submitDisabled,
  variant = "primary",
  left,
  submitClassName,
  submitChildren,
  submitType = "submit",
  onSubmit,
}: DialogFooterProps) {
  const buttonStyle = variant === "danger" ? BUTTON_DANGER : BUTTON_PRIMARY;
  const combinedClass = submitClassName
    ? `${submitClassName} ${buttonStyle}`
    : buttonStyle;

  return (
    <div className={`flex ${left ? "justify-between" : "justify-end"} gap-3`}>
      {left && <div className="flex items-center">{left}</div>}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className={BUTTON_CANCEL}>
          Cancel
        </button>
        <button
          type={submitType}
          disabled={submitDisabled}
          className={combinedClass}
          onClick={submitType === "button" ? onSubmit : undefined}
        >
          {submitChildren ?? submitLabel}
        </button>
      </div>
    </div>
  );
}
