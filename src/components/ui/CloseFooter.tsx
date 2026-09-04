import { BUTTON_CANCEL } from "./button-styles";

interface CloseFooterProps {
  onClose: () => void;
  label?: string;
}

export function CloseFooter({ onClose, label = "Close" }: CloseFooterProps) {
  return (
    <div className="flex justify-end">
      <button type="button" onClick={onClose} className={BUTTON_CANCEL}>
        {label}
      </button>
    </div>
  );
}
