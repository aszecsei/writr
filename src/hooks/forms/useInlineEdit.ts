import { useCallback, useEffect, useRef, useState } from "react";

interface UseInlineEditOptions {
  initialValue: string;
  onSave: (value: string) => void;
  saveOnEnter?: boolean;
  saveOnCtrlEnter?: boolean;
}

export function useInlineEdit({
  initialValue,
  onSave,
  saveOnEnter = true,
  saveOnCtrlEnter = false,
}: UseInlineEditOptions) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Sync when external value changes while not editing
  useEffect(() => {
    if (!isEditing) {
      setEditValue(initialValue);
    }
  }, [initialValue, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      } else {
        inputRef.current.selectionStart = inputRef.current.value.length;
      }
    }
  }, [isEditing]);

  const startEditing = useCallback(() => {
    setEditValue(initialValue);
    setIsEditing(true);
  }, [initialValue]);

  const saveAndClose = useCallback(() => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed !== initialValue) {
      onSave(trimmed);
    }
  }, [editValue, initialValue, onSave]);

  const cancelEdit = useCallback(() => {
    setEditValue(initialValue);
    setIsEditing(false);
  }, [initialValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelEdit();
      } else if (e.key === "Enter") {
        if (saveOnCtrlEnter && (e.metaKey || e.ctrlKey)) {
          saveAndClose();
        } else if (saveOnEnter && !saveOnCtrlEnter) {
          saveAndClose();
        }
      }
    },
    [cancelEdit, saveAndClose, saveOnEnter, saveOnCtrlEnter],
  );

  return {
    isEditing,
    editValue,
    setEditValue,
    inputRef,
    startEditing,
    saveAndClose,
    cancelEdit,
    handleKeyDown,
  };
}
