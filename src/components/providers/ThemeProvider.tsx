"use client";

import { useEffect } from "react";
import { useAppSettings } from "@/hooks/useAppSettings";
import {
  applyEditorWidth,
  applyNeutralColor,
  applyPrimaryColor,
  applyUiDensity,
} from "@/lib/theme/apply-theme";

export function ThemeProvider() {
  const settings = useAppSettings();
  const theme = settings?.theme ?? "system";
  const primaryColor = settings?.primaryColor ?? "blue";
  const neutralColor = settings?.neutralColor ?? "zinc";
  const editorWidth = settings?.editorWidth ?? "medium";
  const uiDensity = settings?.uiDensity ?? "comfortable";

  useEffect(() => {
    function apply(resolved: "light" | "dark") {
      document.documentElement.classList.toggle("dark", resolved === "dark");
      localStorage.setItem("writr-theme", resolved);
    }

    if (theme !== "system") {
      apply(theme);
      return;
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    apply(mq.matches ? "dark" : "light");

    function onChange(e: MediaQueryListEvent) {
      apply(e.matches ? "dark" : "light");
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    applyPrimaryColor(primaryColor);
  }, [primaryColor]);

  useEffect(() => {
    applyNeutralColor(neutralColor);
  }, [neutralColor]);

  useEffect(() => {
    applyEditorWidth(editorWidth);
  }, [editorWidth]);

  useEffect(() => {
    applyUiDensity(uiDensity);
  }, [uiDensity]);

  return null;
}
