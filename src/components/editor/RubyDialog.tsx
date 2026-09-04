"use client";

import { Languages } from "lucide-react";
import { TextPromptDialog } from "@/components/ui/TextPromptDialog";
import { isRubyEditorModal, useUiStore } from "@/store/uiStore";

interface RubyDialogProps {
  onApply: (annotation: string) => void;
  onRemove: () => void;
}

export function RubyDialog({ onApply, onRemove }: RubyDialogProps) {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);

  const isOpen = isRubyEditorModal(modal);
  const currentAnnotation = isOpen ? modal.currentAnnotation : undefined;

  return (
    <TextPromptDialog
      isOpen={isOpen}
      title={currentAnnotation ? "Edit Ruby Text" : "Insert Ruby Text"}
      description="Add reading guides or annotations above selected text"
      icon={Languages}
      fields={[
        {
          id: "ruby-annotation",
          label: "Annotation",
          placeholder: "e.g., furigana, pinyin, pronunciation",
        },
      ]}
      initialValues={{ "ruby-annotation": currentAnnotation ?? "" }}
      onClose={closeModal}
      onApply={(values) => onApply(values["ruby-annotation"])}
      onRemove={onRemove}
      canRemove={!!currentAnnotation}
      removeLabel="Remove"
      applyLabel="Apply"
    />
  );
}
