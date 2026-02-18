"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
import type {
  AiProvider,
  EditorWidth,
  GoalCountdownDisplay,
  NeutralColor,
  PrimaryColor,
  ReasoningEffort,
  UiDensity,
} from "@/db/schemas";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import { getDefaultProviderModels } from "@/lib/ai/providers";
import type { Backup } from "@/lib/backup";
import {
  applyEditorWidth,
  applyNeutralColor,
  applyPrimaryColor,
  applyUiDensity,
} from "@/lib/theme/apply-theme";
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
  const [primaryColor, setPrimaryColor] = useState<PrimaryColor>("blue");
  const [neutralColor, setNeutralColor] = useState<NeutralColor>("zinc");
  const [editorWidth, setEditorWidth] = useState<EditorWidth>("medium");
  const [uiDensity, setUiDensity] = useState<UiDensity>("comfortable");
  const [editorFont, setEditorFont] = useState("literata");
  const [editorFontSize, setEditorFontSize] = useState(16);
  const [autoSaveSeconds, setAutoSaveSeconds] = useState(3);
  const [readingSpeedWpm, setReadingSpeedWpm] = useState(200);
  const [autoFocusModeOnSprint, setAutoFocusModeOnSprint] = useState(false);
  const [goalCountdownDisplay, setGoalCountdownDisplay] =
    useState<GoalCountdownDisplay>("estimated-date");
  const [enableAiFeatures, setEnableAiFeatures] = useState(false);
  const [aiProvider, setAiProvider] = useState<AiProvider>("openrouter");
  const emptyKeys: Record<AiProvider, string> = {
    openrouter: "",
    anthropic: "",
    openai: "",
    grok: "",
    zai: "",
    google: "",
    vertex: "",
  };
  const [providerApiKeys, setProviderApiKeys] =
    useState<Record<AiProvider, string>>(emptyKeys);
  const [providerModels, setProviderModels] = useState<
    Record<AiProvider, string>
  >(getDefaultProviderModels);
  const [debugMode, setDebugMode] = useState(false);
  const [streamResponses, setStreamResponses] = useState(true);
  const [reasoningEffort, setReasoningEffort] =
    useState<ReasoningEffort>("medium");
  const [enableToolCalling, setEnableToolCalling] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    backup: Backup;
    filename: string;
  } | null>(null);

  // Snapshot of saved settings at dialog open, used to revert on cancel
  const savedSettingsRef = useRef(settings);

  // Track whether we've initialized state for this dialog session
  const initializedRef = useRef(false);

  // Reset initialization flag when dialog closes
  useEffect(() => {
    if (modal.id !== "app-settings") {
      initializedRef.current = false;
    }
  }, [modal.id]);

  // Sync local state from DB settings — only once when dialog opens.
  // The initializedRef prevents re-syncing (and wiping user changes)
  // if settings reference changes while the dialog is open.
  useEffect(() => {
    if (settings && modal.id === "app-settings" && !initializedRef.current) {
      initializedRef.current = true;
      savedSettingsRef.current = settings;
      setTab("general");
      setTheme(settings.theme);
      setPrimaryColor(settings.primaryColor);
      setNeutralColor(settings.neutralColor);
      setEditorWidth(settings.editorWidth);
      setUiDensity(settings.uiDensity);
      setEditorFont(settings.editorFont);
      setEditorFontSize(settings.editorFontSize);
      setAutoSaveSeconds(Math.round(settings.autoSaveIntervalMs / 1000));
      setReadingSpeedWpm(settings.readingSpeedWpm);
      setAutoFocusModeOnSprint(settings.autoFocusModeOnSprint);
      setGoalCountdownDisplay(settings.goalCountdownDisplay);
      setEnableAiFeatures(settings.enableAiFeatures);
      setAiProvider(settings.aiProvider);
      setProviderApiKeys(settings.providerApiKeys);
      setProviderModels(settings.providerModels);
      setDebugMode(settings.debugMode);
      setStreamResponses(settings.streamResponses);
      setReasoningEffort(settings.reasoningEffort);
      setEnableToolCalling(settings.enableToolCalling);
    }
  }, [settings, modal.id]);

  // Live preview: apply theme changes immediately
  const handlePrimaryColorChange = useCallback((color: PrimaryColor) => {
    setPrimaryColor(color);
    applyPrimaryColor(color);
  }, []);

  const handleNeutralColorChange = useCallback((color: NeutralColor) => {
    setNeutralColor(color);
    applyNeutralColor(color);
  }, []);

  const handleEditorWidthChange = useCallback((width: EditorWidth) => {
    setEditorWidth(width);
    applyEditorWidth(width);
  }, []);

  const handleUiDensityChange = useCallback((density: UiDensity) => {
    setUiDensity(density);
    applyUiDensity(density);
  }, []);

  // Revert live preview on cancel using the snapshot taken at dialog open
  const handleCancel = useCallback(() => {
    const saved = savedSettingsRef.current;
    if (saved) {
      applyPrimaryColor(saved.primaryColor);
      applyNeutralColor(saved.neutralColor);
      applyEditorWidth(saved.editorWidth);
      applyUiDensity(saved.uiDensity);
    }
    closeModal();
  }, [closeModal]);

  if (modal.id !== "app-settings") return null;

  const isDirty =
    settings != null &&
    (theme !== settings.theme ||
      primaryColor !== settings.primaryColor ||
      neutralColor !== settings.neutralColor ||
      editorWidth !== settings.editorWidth ||
      uiDensity !== settings.uiDensity ||
      editorFont !== settings.editorFont ||
      editorFontSize !== settings.editorFontSize ||
      autoSaveSeconds !== Math.round(settings.autoSaveIntervalMs / 1000) ||
      readingSpeedWpm !== settings.readingSpeedWpm ||
      autoFocusModeOnSprint !== settings.autoFocusModeOnSprint ||
      goalCountdownDisplay !== settings.goalCountdownDisplay ||
      enableAiFeatures !== settings.enableAiFeatures ||
      aiProvider !== settings.aiProvider ||
      JSON.stringify(providerApiKeys) !==
        JSON.stringify(settings.providerApiKeys) ||
      JSON.stringify(providerModels) !==
        JSON.stringify(settings.providerModels) ||
      debugMode !== settings.debugMode ||
      streamResponses !== settings.streamResponses ||
      reasoningEffort !== settings.reasoningEffort ||
      enableToolCalling !== settings.enableToolCalling);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await updateAppSettings({
      theme,
      primaryColor,
      neutralColor,
      editorWidth,
      uiDensity,
      editorFont,
      editorFontSize,
      autoSaveIntervalMs: autoSaveSeconds * 1000,
      readingSpeedWpm,
      autoFocusModeOnSprint,
      goalCountdownDisplay,
      enableAiFeatures,
      aiProvider,
      providerApiKeys,
      providerModels,
      debugMode,
      streamResponses,
      reasoningEffort,
      enableToolCalling,
    });
    closeModal();
  }

  return (
    <Modal onClose={handleCancel} maxWidth="max-w-2xl">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
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
            primaryColor={primaryColor}
            onPrimaryColorChange={handlePrimaryColorChange}
            neutralColor={neutralColor}
            onNeutralColorChange={handleNeutralColorChange}
            editorWidth={editorWidth}
            onEditorWidthChange={handleEditorWidthChange}
            uiDensity={uiDensity}
            onUiDensityChange={handleUiDensityChange}
            goalCountdownDisplay={goalCountdownDisplay}
            onGoalCountdownDisplayChange={setGoalCountdownDisplay}
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
            aiProvider={aiProvider}
            providerApiKeys={providerApiKeys}
            providerModels={providerModels}
            streamResponses={streamResponses}
            reasoningEffort={reasoningEffort}
            debugMode={debugMode}
            enableToolCalling={enableToolCalling}
            onEnableAiFeaturesChange={setEnableAiFeatures}
            onAiProviderChange={setAiProvider}
            onProviderApiKeyChange={(provider, key) =>
              setProviderApiKeys((prev) => ({ ...prev, [provider]: key }))
            }
            onProviderModelChange={(provider, model) =>
              setProviderModels((prev) => ({ ...prev, [provider]: model }))
            }
            onStreamResponsesChange={setStreamResponses}
            onReasoningEffortChange={setReasoningEffort}
            onDebugModeChange={setDebugMode}
            onEnableToolCallingChange={setEnableToolCalling}
            onConfigureAi={() => openModal({ id: "ai-config" })}
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
          onCancel={handleCancel}
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
