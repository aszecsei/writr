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
      } catch (err) {
        console.error("[useAutoSave] Save failed:", err);
        markSaveError();
      }
    }, intervalMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isDirty, saveFn, intervalMs, markSaving, markSaved, markSaveError]);

  // Flush on unmount (e.g. toggling focus mode recreates the editor) so
  // in-flight content isn't lost while waiting on the debounce timer above.
  // Read via a ref so the mount-once cleanup below calls the latest saveFn.
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;
  useEffect(() => {
    return () => {
      void saveFnRef.current();
    };
  }, []);
}
