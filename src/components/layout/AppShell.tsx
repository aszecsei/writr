"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { AiPanel } from "@/components/ai/AiPanel";
import { FocusModeOverlay } from "@/components/editor/FocusModeOverlay";
import { VersionHistoryDialog } from "@/components/editor/VersionHistoryDialog";
import { ExportDialog } from "@/components/export/ExportDialog";
import { PreviewCardDialog } from "@/components/preview-card/PreviewCardDialog";
import { AiConfigDialog } from "@/components/settings/AiConfigDialog";
import { AppSettingsDialog } from "@/components/settings/AppSettingsDialog";
import { DictionaryManagerDialog } from "@/components/settings/DictionaryManagerDialog";
import {
  SprintConfigDialog,
  SprintHistoryDialog,
  SprintWidget,
} from "@/components/sprint";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import { useFocusModeShortcuts } from "@/hooks/ui/useFocusModeShortcuts";
import { useUiStore } from "@/store/uiStore";
import { Sidebar } from "./sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const aiPanelOpen = useUiStore((s) => s.aiPanelOpen);
  const closeAiPanel = useUiStore((s) => s.closeAiPanel);
  const focusModeEnabled = useUiStore((s) => s.focusModeEnabled);
  const setFocusMode = useUiStore((s) => s.setFocusMode);
  const settings = useAppSettings();

  // Register global keyboard shortcuts for focus mode
  useFocusModeShortcuts();

  // Handle browser fullscreen API
  useEffect(() => {
    async function handleFullscreen() {
      if (focusModeEnabled) {
        // Enter fullscreen
        if (!document.fullscreenElement) {
          try {
            await document.documentElement.requestFullscreen();
          } catch {
            // Fullscreen may not be available in all contexts
          }
        }
      } else {
        // Exit fullscreen
        if (document.fullscreenElement) {
          try {
            await document.exitFullscreen();
          } catch {
            // May fail if not in fullscreen
          }
        }
      }
    }
    handleFullscreen();
  }, [focusModeEnabled]);

  // Listen for user exiting fullscreen via Escape/F11 and sync state
  useEffect(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement && focusModeEnabled) {
        setFocusMode(false);
      }
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [focusModeEnabled, setFocusMode]);

  // Close AI panel if AI features are disabled
  useEffect(() => {
    if (!settings?.enableAiFeatures && aiPanelOpen) {
      closeAiPanel();
    }
  }, [settings?.enableAiFeatures, aiPanelOpen, closeAiPanel]);

  // In focus mode, render a simplified layout without unmounting children
  if (focusModeEnabled) {
    return (
      <div className="flex h-screen flex-col">
        <FocusModeOverlay />
        <main className="h-full overflow-y-auto">{children}</main>
        <SprintWidget />
        <AppSettingsDialog />
        <AiConfigDialog />
        <DictionaryManagerDialog />
        <VersionHistoryDialog />
        <SprintConfigDialog />
        <SprintHistoryDialog />
      </div>
    );
  }

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
        {aiPanelOpen && settings?.enableAiFeatures && (
          <>
            <Separator className="resize-handle" />
            <Panel id="ai-panel" defaultSize="25%" minSize="15%">
              <AiPanel />
            </Panel>
          </>
        )}
      </Group>
      <AppSettingsDialog />
      <AiConfigDialog />
      <DictionaryManagerDialog />
      <VersionHistoryDialog />
      <ExportDialog />
      <PreviewCardDialog />
      <SprintConfigDialog />
      <SprintHistoryDialog />
      <SprintWidget />
    </div>
  );
}
