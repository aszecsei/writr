"use client";

import { useEffect } from "react";
import { useUiStore } from "@/store/uiStore";

export function useFocusModeShortcuts() {
  const focusModeEnabled = useUiStore((s) => s.focusModeEnabled);
  const toggleFocusMode = useUiStore((s) => s.toggleFocusMode);
  const setFocusMode = useUiStore((s) => s.setFocusMode);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Escape exits focus mode (only if not in browser fullscreen,
      // since browser handles Escape for fullscreen and we sync via fullscreenchange event)
      if (
        e.key === "Escape" &&
        focusModeEnabled &&
        !document.fullscreenElement
      ) {
        e.preventDefault();
        setFocusMode(false);
        return;
      }

      // Ctrl/Cmd + Shift + F toggles focus mode
      if (e.key === "F" && e.shiftKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggleFocusMode();
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusModeEnabled, toggleFocusMode, setFocusMode]);
}
