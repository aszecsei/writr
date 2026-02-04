"use client";

import type { ReactNode } from "react";
import { RadioPlayer } from "@/components/radio/RadioPlayer";
import { ThemeProvider } from "./ThemeProvider";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <>
      <ThemeProvider />
      <RadioPlayer />
      {children}
    </>
  );
}
