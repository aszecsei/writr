"use client";

import type { ReactNode } from "react";
import { AiPanel } from "@/components/ai/AiPanel";
import { AppSettingsDialog } from "@/components/settings/AppSettingsDialog";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
        <AiPanel />
      </div>
      <AppSettingsDialog />
    </div>
  );
}
