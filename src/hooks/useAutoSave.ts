"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "@/store/editorStore";

export function useAutoSave(saveFn: () => Promise<void>, intervalMs = 3000) {
  const isDirty = useEditorStore((s) => s.isDirty);
  const markSaving = useEditorStore((s) => s.markSaving);
  const markSaved = useEditorStore((s) => s.markSaved);
  const markSaveError = useEditorStore((s) => s.markSaveError);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isDirty) return;

    timerRef.current = setTimeout(async () => {
      markSaving();
      try {
        await saveFn();
        markSaved();
      } catch {
        markSaveError();
      }
    }, intervalMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isDirty, saveFn, intervalMs, markSaving, markSaved, markSaveError]);
}
