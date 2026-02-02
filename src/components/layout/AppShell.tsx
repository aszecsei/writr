"use client";

import type { ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { AiPanel } from "@/components/ai/AiPanel";
import { AppSettingsDialog } from "@/components/settings/AppSettingsDialog";
import { useUiStore } from "@/store/uiStore";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const aiPanelOpen = useUiStore((s) => s.aiPanelOpen);

  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <Group orientation="horizontal" id="app-shell">
        {sidebarOpen && (
          <>
            <Panel id="sidebar" defaultSize="15%" minSize="10%">
              <Sidebar />
            </Panel>
            <Separator className="resize-handle" />
          </>
        )}
        <Panel id="main" minSize="30%">
          <main className="h-full overflow-y-auto">{children}</main>
        </Panel>
        {aiPanelOpen && (
          <>
            <Separator className="resize-handle" />
            <Panel id="ai-panel" defaultSize="25%" minSize="15%">
              <AiPanel />
            </Panel>
          </>
        )}
      </Group>
      <AppSettingsDialog />
    </div>
  );
}
