"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { updateChapter } from "@/db/operations";
import type { ChapterId } from "@/db/schemas";

/**
 * Inline-rename state for a binder chapter row: which chapter is being
 * renamed, its in-progress value, and the commit/cancel key handling.
 */
export function useBinderRename(onStart?: () => void) {
  const [renamingChapterId, setRenamingChapterId] = useState<ChapterId | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingChapterId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingChapterId]);

  const startRename = useCallback(
    (chapterId: ChapterId, currentTitle: string) => {
      setRenamingChapterId(chapterId);
      setRenameValue(currentTitle);
      onStart?.();
    },
    [onStart],
  );

  const commitRename = useCallback(async () => {
    if (renamingChapterId && renameValue.trim()) {
      await updateChapter(renamingChapterId, { title: renameValue.trim() });
    }
    setRenamingChapterId(null);
  }, [renamingChapterId, renameValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") commitRename();
      else if (e.key === "Escape") setRenamingChapterId(null);
    },
    [commitRename],
  );

  return {
    renamingChapterId,
    renameValue,
    renameInputRef,
    setRenameValue,
    startRename,
    commitRename,
    handleKeyDown,
  };
}
