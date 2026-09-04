"use client";

import { Link2Off } from "lucide-react";
import { TextPromptDialog } from "@/components/ui/TextPromptDialog";
import { isLinkEditorModal, useUiStore } from "@/store/uiStore";

interface LinkEditorDialogProps {
  onApply: (href: string) => void;
  onRemove: () => void;
}

export function LinkEditorDialog({ onApply, onRemove }: LinkEditorDialogProps) {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);

  const isOpen = isLinkEditorModal(modal);
  const currentHref = isOpen ? modal.currentHref : undefined;

  return (
    <TextPromptDialog
      isOpen={isOpen}
      title={currentHref ? "Edit Link" : "Insert Link"}
      fields={[
        {
          id: "link-url",
          label: "URL",
          type: "url",
          placeholder: "https://example.com",
        },
      ]}
      initialValues={{ "link-url": currentHref ?? "" }}
      onClose={closeModal}
      onApply={(values) => onApply(values["link-url"])}
      onRemove={onRemove}
      canRemove={!!currentHref}
      removeIcon={Link2Off}
      removeLabel="Remove"
      applyLabel="Apply"
    />
  );
}
