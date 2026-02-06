"use client";

import { type FormEvent, useEffect, useState } from "react";
import { BUTTON_CANCEL, BUTTON_PRIMARY } from "@/components/ui/button-styles";
import { Modal } from "@/components/ui/Modal";
import { updateAppSettings } from "@/db/operations";
import type { ReasoningEffort } from "@/db/schemas";
import { useAppSettings } from "@/hooks/useAppSettings";
import type { Backup } from "@/lib/backup";
import { useUiStore } from "@/store/uiStore";
import { AiSettings } from "./AiSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { BackupSettings } from "./BackupSettings";
import { EditorSettings } from "./EditorSettings";
import { ImportBackupDialog } from "./ImportBackupDialog";

const INPUT_CLASS =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";

const LABEL_CLASS =
  "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

export function AppSettingsDialog() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const settings = useAppSettings();

  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [editorFont, setEditorFont] = useState("literata");
  const [editorFontSize, setEditorFontSize] = useState(16);
  const [autoSaveSeconds, setAutoSaveSeconds] = useState(3);
  const [readingSpeedWpm, setReadingSpeedWpm] = useState(200);
  const [autoFocusModeOnSprint, setAutoFocusModeOnSprint] = useState(false);
  const [enableAiFeatures, setEnableAiFeatures] = useState(false);
  const [openRouterApiKey, setOpenRouterApiKey] = useState("");
  const [preferredModel, setPreferredModel] = useState("openai/gpt-4o");
  const [debugMode, setDebugMode] = useState(false);
  const [streamResponses, setStreamResponses] = useState(true);
  const [reasoningEffort, setReasoningEffort] =
    useState<ReasoningEffort>("medium");

  const [pendingImport, setPendingImport] = useState<{
    backup: Backup;
    filename: string;
  } | null>(null);

  useEffect(() => {
    if (settings) {
      setTheme(settings.theme);
      setEditorFont(settings.editorFont);
      setEditorFontSize(settings.editorFontSize);
      setAutoSaveSeconds(Math.round(settings.autoSaveIntervalMs / 1000));
      setReadingSpeedWpm(settings.readingSpeedWpm);
      setAutoFocusModeOnSprint(settings.autoFocusModeOnSprint);
      setEnableAiFeatures(settings.enableAiFeatures);
      setOpenRouterApiKey(settings.openRouterApiKey);
      setPreferredModel(settings.preferredModel);
      setDebugMode(settings.debugMode);
      setStreamResponses(settings.streamResponses);
      setReasoningEffort(settings.reasoningEffort);
    }
  }, [settings]);

  if (modal.id !== "app-settings") return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await updateAppSettings({
      theme,
      editorFont,
      editorFontSize,
      autoSaveIntervalMs: autoSaveSeconds * 1000,
      readingSpeedWpm,
      autoFocusModeOnSprint,
      enableAiFeatures,
      openRouterApiKey,
      preferredModel,
      debugMode,
      streamResponses,
      reasoningEffort,
    });
    closeModal();
  }

  return (
    <Modal onClose={closeModal} maxWidth="max-w-lg">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        App Settings
      </h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-6">
        <AppearanceSettings
          theme={theme}
          onThemeChange={setTheme}
          inputClass={INPUT_CLASS}
          labelClass={LABEL_CLASS}
        />

        <EditorSettings
          editorFont={editorFont}
          editorFontSize={editorFontSize}
          autoSaveSeconds={autoSaveSeconds}
          readingSpeedWpm={readingSpeedWpm}
          autoFocusModeOnSprint={autoFocusModeOnSprint}
          onEditorFontChange={setEditorFont}
          onEditorFontSizeChange={setEditorFontSize}
          onAutoSaveSecondsChange={setAutoSaveSeconds}
          onReadingSpeedWpmChange={setReadingSpeedWpm}
          onAutoFocusModeOnSprintChange={setAutoFocusModeOnSprint}
          inputClass={INPUT_CLASS}
          labelClass={LABEL_CLASS}
        />

        <AiSettings
          enableAiFeatures={enableAiFeatures}
          openRouterApiKey={openRouterApiKey}
          preferredModel={preferredModel}
          streamResponses={streamResponses}
          reasoningEffort={reasoningEffort}
          debugMode={debugMode}
          onEnableAiFeaturesChange={setEnableAiFeatures}
          onOpenRouterApiKeyChange={setOpenRouterApiKey}
          onPreferredModelChange={setPreferredModel}
          onStreamResponsesChange={setStreamResponses}
          onReasoningEffortChange={setReasoningEffort}
          onDebugModeChange={setDebugMode}
          inputClass={INPUT_CLASS}
          labelClass={LABEL_CLASS}
        />

        <BackupSettings
          onImportReady={(backup, filename) =>
            setPendingImport({ backup, filename })
          }
        />

        <div className="flex justify-end gap-3">
          <button type="button" onClick={closeModal} className={BUTTON_CANCEL}>
            Cancel
          </button>
          <button type="submit" className={BUTTON_PRIMARY}>
            Save
          </button>
        </div>
      </form>

      {pendingImport && (
        <ImportBackupDialog
          backup={pendingImport.backup}
          filename={pendingImport.filename}
          onClose={() => setPendingImport(null)}
          onImportComplete={() => {
            // Result is shown in the dialog, user will close it
          }}
        />
      )}
    </Modal>
  );
}
