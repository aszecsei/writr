"use client";

import { TextPromptDialog } from "@/components/ui/TextPromptDialog";
import { useUiStore } from "@/store/uiStore";

interface InsertImageDialogProps {
  onInsert: (src: string, alt: string) => void;
}

export function InsertImageDialog({ onInsert }: InsertImageDialogProps) {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);

  const isOpen = modal.id === "insert-image";

  return (
    <TextPromptDialog
      isOpen={isOpen}
      title="Insert Image"
      fields={[
        {
          id: "image-url",
          label: "Image URL",
          type: "url",
          placeholder: "https://example.com/image.jpg",
        },
        {
          id: "image-alt",
          label: "Alt Text (optional)",
          placeholder: "Description of the image",
        },
      ]}
      initialValues={{ "image-url": "", "image-alt": "" }}
      onClose={closeModal}
      onApply={(values) => onInsert(values["image-url"], values["image-alt"])}
      applyLabel="Insert"
    />
  );
}
