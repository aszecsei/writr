"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "./ThemeProvider";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <>
      <ThemeProvider />
      {children}
    </>
  );
}
