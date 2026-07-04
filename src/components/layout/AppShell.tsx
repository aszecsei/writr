"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { ApproveJoinDialog } from "@/components/collab/ApproveJoinDialog";
import { CollabBanner } from "@/components/collab/CollabBanner";
import { ManageParticipantsDialog } from "@/components/collab/ManageParticipantsDialog";
import { ShareDialog } from "@/components/collab/ShareDialog";
import { ChapterPropertiesDialog } from "@/components/editor/ChapterPropertiesDialog";
import { FocusModeOverlay } from "@/components/editor/FocusModeOverlay";
import { VersionHistoryDialog } from "@/components/editor/VersionHistoryDialog";
import { ExportDialog } from "@/components/export/ExportDialog";
import { SeparatorSettingsDialog } from "@/components/layout/sidebar/SeparatorSettingsDialog";
import { RightPanel } from "@/components/panels/RightPanel";
import { PreviewCardDialog } from "@/components/preview-card/PreviewCardDialog";
import { SavedPromptsManager } from "@/components/settings/SavedPromptsManager";
import { SettingsModals } from "@/components/settings/SettingsModals";
import { ShortcutsHelpDialog } from "@/components/settings/ShortcutsHelpDialog";
import {
  SprintConfigDialog,
  SprintHistoryDialog,
  SprintWidget,
} from "@/components/sprint";
import { TtsPlayerBar } from "@/components/tts/TtsPlayerBar";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import { useShortcuts } from "@/hooks/ui/useShortcuts";
import { isCollabEnabled } from "@/lib/collab/config";
import { useUiStore } from "@/store/uiStore";
import { Sidebar } from "./sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const rightPanel = useUiStore((s) => s.rightPanel);
  const closeRightPanel = useUiStore((s) => s.closeRightPanel);
  const focusModeEnabled = useUiStore((s) => s.focusModeEnabled);
  const setFocusMode = useUiStore((s) => s.setFocusMode);
  const settings = useAppSettings();

  // Register the global keyboard-shortcut dispatcher (navigation, create
  // commands, focus mode, search, help overlay).
  useShortcuts();

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

  // Close the right panel if it's showing the AI tab but AI features are off.
  useEffect(() => {
    if (
      !settings?.enableAiFeatures &&
      rightPanel.open &&
      rightPanel.tab === "ai"
    ) {
      closeRightPanel();
    }
  }, [settings?.enableAiFeatures, rightPanel, closeRightPanel]);

  // In focus mode, render a simplified layout without unmounting children
  if (focusModeEnabled) {
    return (
      <div className="flex h-screen flex-col">
        <FocusModeOverlay />
        <main className="h-full overflow-y-auto">{children}</main>
        <SprintWidget />
        <SettingsModals />
        <SavedPromptsManager />
        <VersionHistoryDialog />
        <ChapterPropertiesDialog />
        <SeparatorSettingsDialog />
        <SprintConfigDialog />
        <SprintHistoryDialog />
        <ShortcutsHelpDialog />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      {isCollabEnabled() && <CollabBanner />}
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
        {rightPanel.open && (
          <>
            <Separator className="resize-handle" />
            <Panel id="right-panel" defaultSize="25%" minSize="15%">
              <RightPanel />
            </Panel>
          </>
        )}
      </Group>
      <TtsPlayerBar />
      <SettingsModals />
      <SavedPromptsManager />
      <VersionHistoryDialog />
      <ChapterPropertiesDialog />
      <SeparatorSettingsDialog />
      <ExportDialog />
      <PreviewCardDialog />
      <SprintConfigDialog />
      <SprintHistoryDialog />
      <SprintWidget />
      <ShortcutsHelpDialog />
      {isCollabEnabled() && <ShareDialog />}
      {isCollabEnabled() && <ApproveJoinDialog />}
      {isCollabEnabled() && <ManageParticipantsDialog />}
    </div>
  );
}
