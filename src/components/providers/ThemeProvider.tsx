"use client";

import { useEffect } from "react";
import { useAppSettings } from "@/hooks/useAppSettings";

export function ThemeProvider() {
  const settings = useAppSettings();
  const theme = settings?.theme ?? "system";

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

  return null;
}
