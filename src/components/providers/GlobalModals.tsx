"use client";

import { ApproveJoinDialog } from "@/components/collab/ApproveJoinDialog";
import { ManageParticipantsDialog } from "@/components/collab/ManageParticipantsDialog";
import { ShareDialog } from "@/components/collab/ShareDialog";
import { ChapterPropertiesDialog } from "@/components/editor/ChapterPropertiesDialog";
import { VersionHistoryDialog } from "@/components/editor/VersionHistoryDialog";
import { ExportDialog } from "@/components/export/ExportDialog";
import { SeparatorSettingsDialog } from "@/components/layout/sidebar/SeparatorSettingsDialog";
import { PreviewCardDialog } from "@/components/preview-card/PreviewCardDialog";
import { SavedPromptsManager } from "@/components/settings/SavedPromptsManager";
import { SettingsModals } from "@/components/settings/SettingsModals";
import { ShortcutsHelpDialog } from "@/components/settings/ShortcutsHelpDialog";
import { SprintConfigDialog, SprintHistoryDialog } from "@/components/sprint";
import { isCollabEnabled } from "@/lib/collab/config";
import { useUiStore } from "@/store/uiStore";

/**
 * Every modal driven by `uiStore.modal`, mounted once for the whole app.
 * Focus mode hides the modals only reachable from UI that focus mode itself
 * hides (the TopBar, sidebar, and editor toolbars) — see docs/state.md.
 */
export function GlobalModals() {
  const focusModeEnabled = useUiStore((s) => s.focusModeEnabled);

  return (
    <>
      <SettingsModals />
      <SavedPromptsManager />
      <VersionHistoryDialog />
      <ChapterPropertiesDialog />
      <SeparatorSettingsDialog />
      <SprintConfigDialog />
      <SprintHistoryDialog />
      <ShortcutsHelpDialog />
      {!focusModeEnabled && (
        <>
          <ExportDialog />
          <PreviewCardDialog />
          {isCollabEnabled() && (
            <>
              <ShareDialog />
              <ApproveJoinDialog />
              <ManageParticipantsDialog />
            </>
          )}
        </>
      )}
    </>
  );
}
