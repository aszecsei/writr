"use client";

import { type FormEvent, useEffect, useState } from "react";
import { DialogFooter } from "@/components/ui/DialogFooter";
import {
  INPUT_CLASS,
  LABEL_CLASS,
  RADIO_ACTIVE,
  RADIO_BASE,
  RADIO_INACTIVE,
} from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import { updateAppSettings } from "@/db/operations";
import type { ReasoningEffort } from "@/db/schemas";
import { useAppSettings } from "@/hooks/useAppSettings";
import type { Backup } from "@/lib/backup";
import { useUiStore } from "@/store/uiStore";
import { AiSettings } from "./AiSettings";
import { BackupSettings } from "./BackupSettings";
import { EditorSettings } from "./EditorSettings";
import { GeneralTabContent } from "./GeneralTabContent";
import { ImportBackupDialog } from "./ImportBackupDialog";

type SettingsTab = "general" | "editor" | "ai" | "data";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "editor", label: "Editor" },
  { id: "ai", label: "AI" },
  { id: "data", label: "Data" },
];

export function AppSettingsDialog() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const openModal = useUiStore((s) => s.openModal);
  const settings = useAppSettings();

  const [tab, setTab] = useState<SettingsTab>("general");
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

  // Reset tab when dialog opens
  useEffect(() => {
    if (modal.id === "app-settings") {
      setTab("general");
    }
  }, [modal.id]);

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

  const isDirty =
    settings != null &&
    (theme !== settings.theme ||
      editorFont !== settings.editorFont ||
      editorFontSize !== settings.editorFontSize ||
      autoSaveSeconds !== Math.round(settings.autoSaveIntervalMs / 1000) ||
      readingSpeedWpm !== settings.readingSpeedWpm ||
      autoFocusModeOnSprint !== settings.autoFocusModeOnSprint ||
      enableAiFeatures !== settings.enableAiFeatures ||
      openRouterApiKey !== settings.openRouterApiKey ||
      preferredModel !== settings.preferredModel ||
      debugMode !== settings.debugMode ||
      streamResponses !== settings.streamResponses ||
      reasoningEffort !== settings.reasoningEffort);

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
    <Modal onClose={closeModal} maxWidth="max-w-2xl">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        App Settings
      </h2>

      {/* Tab bar */}
      <div className="mt-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${RADIO_BASE} ${tab === t.id ? RADIO_ACTIVE : RADIO_INACTIVE}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-6">
        {tab === "general" && (
          <GeneralTabContent
            theme={theme}
            onThemeChange={setTheme}
            inputClass={INPUT_CLASS}
            labelClass={LABEL_CLASS}
          />
        )}

        {tab === "editor" && (
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
            onManageDictionaries={() => openModal({ id: "dictionary-manager" })}
            inputClass={INPUT_CLASS}
            labelClass={LABEL_CLASS}
          />
        )}

        {tab === "ai" && (
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
        )}

        {tab === "data" && (
          <BackupSettings
            onImportReady={(backup, filename) =>
              setPendingImport({ backup, filename })
            }
          />
        )}

        <DialogFooter
          onCancel={closeModal}
          submitLabel="Save"
          submitDisabled={!isDirty}
        />
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
