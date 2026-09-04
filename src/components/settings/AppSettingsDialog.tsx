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
  RADIO_ACTIVE,
  RADIO_BASE,
  RADIO_INACTIVE,
} from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import { updateAppSettings } from "@/db/operations";
import type {
  AiProvider,
  AppSettings,
  EditorWidth,
  GoalCountdownDisplay,
  NeutralColor,
  PrimaryColor,
  ReasoningEffort,
  UiDensity,
} from "@/db/schemas";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import {
  getDefaultProviderModels,
  getDefaultProviderTtsModels,
  getDefaultProviderTtsVoices,
} from "@/lib/ai/providers";
import {
  applyEditorWidth,
  applyHoleHighlightOpacity,
  applyNeutralColor,
  applyPrimaryColor,
  applyUiDensity,
} from "@/lib/theme/apply-theme";
import { useUiStore } from "@/store/uiStore";
import { AiSettings } from "./AiSettings";
import { BackupSettings } from "./BackupSettings";
import { EditorSettings } from "./EditorSettings";
import { GeneralTabContent } from "./GeneralTabContent";

type SettingsTab = "general" | "editor" | "ai" | "data";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "editor", label: "Editor" },
  { id: "ai", label: "AI" },
  { id: "data", label: "Data" },
];

/** The subset of `AppSettings` fields the dialog's General/Editor/AI tabs
 *  edit. Deliberately excludes fields owned by other dialogs (grammar rule
 *  overrides, saved-prompt fields, etc.) so this form never clobbers
 *  concurrent edits made elsewhere while it's open. */
export interface AppSettingsDraft {
  theme: "light" | "dark" | "system";
  primaryColor: PrimaryColor;
  neutralColor: NeutralColor;
  editorWidth: EditorWidth;
  uiDensity: UiDensity;
  editorFont: string;
  editorFontSize: number;
  autoSaveSeconds: number;
  readingSpeedWpm: number;
  autoFocusModeOnSprint: boolean;
  grammarCheckerEnabled: boolean;
  holeOpenDelimiter: string;
  holeCloseDelimiter: string;
  holeHighlightOpacity: number;
  goalCountdownDisplay: GoalCountdownDisplay;
  enableAiFeatures: boolean;
  aiProvider: AiProvider;
  providerApiKeys: Record<AiProvider, string>;
  providerModels: Record<AiProvider, string>;
  providerTtsModels: Record<AiProvider, string>;
  providerTtsVoices: Record<AiProvider, string>;
  debugMode: boolean;
  streamResponses: boolean;
  reasoningEffort: ReasoningEffort;
  enableToolCalling: boolean;
  loreRetrievalEnabled: boolean;
  omniscientMode: boolean;
  loreTopK: number;
  sceneTopK: number;
  similarityFloor: number;
}

export type SetAppSettingsField = <K extends keyof AppSettingsDraft>(
  key: K,
  value: AppSettingsDraft[K],
) => void;

export const DEFAULT_APP_SETTINGS_DRAFT: AppSettingsDraft = {
  theme: "system",
  primaryColor: "blue",
  neutralColor: "zinc",
  editorWidth: "medium",
  uiDensity: "comfortable",
  editorFont: "literata",
  editorFontSize: 16,
  autoSaveSeconds: 3,
  readingSpeedWpm: 200,
  autoFocusModeOnSprint: false,
  grammarCheckerEnabled: false,
  holeOpenDelimiter: "[",
  holeCloseDelimiter: "]",
  holeHighlightOpacity: 0.18,
  goalCountdownDisplay: "estimated-date",
  enableAiFeatures: false,
  aiProvider: "openrouter",
  providerApiKeys: {
    openrouter: "",
    anthropic: "",
    openai: "",
    grok: "",
    zai: "",
    google: "",
    vertex: "",
  },
  providerModels: getDefaultProviderModels(),
  providerTtsModels: getDefaultProviderTtsModels(),
  providerTtsVoices: getDefaultProviderTtsVoices(),
  debugMode: false,
  streamResponses: true,
  reasoningEffort: "medium",
  enableToolCalling: false,
  loreRetrievalEnabled: false,
  omniscientMode: false,
  loreTopK: 5,
  sceneTopK: 3,
  similarityFloor: 0.3,
};

function settingsToDraft(settings: AppSettings): AppSettingsDraft {
  return {
    theme: settings.theme,
    primaryColor: settings.primaryColor,
    neutralColor: settings.neutralColor,
    editorWidth: settings.editorWidth,
    uiDensity: settings.uiDensity,
    editorFont: settings.editorFont,
    editorFontSize: settings.editorFontSize,
    autoSaveSeconds: Math.round(settings.autoSaveIntervalMs / 1000),
    readingSpeedWpm: settings.readingSpeedWpm,
    autoFocusModeOnSprint: settings.autoFocusModeOnSprint,
    grammarCheckerEnabled: settings.grammarCheckerEnabled,
    holeOpenDelimiter: settings.holeDelimiters.open,
    holeCloseDelimiter: settings.holeDelimiters.close,
    holeHighlightOpacity: settings.holeHighlightOpacity,
    goalCountdownDisplay: settings.goalCountdownDisplay,
    enableAiFeatures: settings.enableAiFeatures,
    aiProvider: settings.aiProvider,
    providerApiKeys: settings.providerApiKeys,
    providerModels: settings.providerModels,
    providerTtsModels: settings.providerTtsModels,
    providerTtsVoices: settings.providerTtsVoices,
    debugMode: settings.debugMode,
    streamResponses: settings.streamResponses,
    reasoningEffort: settings.reasoningEffort,
    enableToolCalling: settings.enableToolCalling,
    loreRetrievalEnabled: settings.loreRetrievalEnabled,
    omniscientMode: settings.omniscientMode,
    loreTopK: settings.loreTopK,
    sceneTopK: settings.sceneTopK,
    similarityFloor: settings.similarityFloor,
  };
}

function draftToUpdatePayload(
  draft: AppSettingsDraft,
): Partial<Omit<AppSettings, "id">> {
  return {
    theme: draft.theme,
    primaryColor: draft.primaryColor,
    neutralColor: draft.neutralColor,
    editorWidth: draft.editorWidth,
    uiDensity: draft.uiDensity,
    editorFont: draft.editorFont,
    editorFontSize: draft.editorFontSize,
    autoSaveIntervalMs: draft.autoSaveSeconds * 1000,
    readingSpeedWpm: draft.readingSpeedWpm,
    autoFocusModeOnSprint: draft.autoFocusModeOnSprint,
    grammarCheckerEnabled: draft.grammarCheckerEnabled,
    holeDelimiters: {
      open: draft.holeOpenDelimiter.trim() || "[",
      close: draft.holeCloseDelimiter.trim() || "]",
    },
    holeHighlightOpacity: draft.holeHighlightOpacity,
    goalCountdownDisplay: draft.goalCountdownDisplay,
    enableAiFeatures: draft.enableAiFeatures,
    aiProvider: draft.aiProvider,
    providerApiKeys: draft.providerApiKeys,
    providerModels: draft.providerModels,
    providerTtsModels: draft.providerTtsModels,
    providerTtsVoices: draft.providerTtsVoices,
    debugMode: draft.debugMode,
    streamResponses: draft.streamResponses,
    reasoningEffort: draft.reasoningEffort,
    enableToolCalling: draft.enableToolCalling,
    loreRetrievalEnabled: draft.loreRetrievalEnabled,
    omniscientMode: draft.omniscientMode,
    loreTopK: draft.loreTopK,
    sceneTopK: draft.sceneTopK,
    similarityFloor: draft.similarityFloor,
  };
}

/** Shallow-diffs `draft` against `saved` (an `AppSettings` snapshot mapped to
 *  the same shape), comparing object-valued fields by content. */
function isDraftDirty(
  draft: AppSettingsDraft,
  saved: AppSettingsDraft,
): boolean {
  return (Object.keys(draft) as (keyof AppSettingsDraft)[]).some((key) => {
    const a = draft[key];
    const b = saved[key];
    if (a && typeof a === "object") {
      return JSON.stringify(a) !== JSON.stringify(b);
    }
    return a !== b;
  });
}

export function AppSettingsDialog() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const openModal = useUiStore((s) => s.openModal);
  const settings = useAppSettings();

  const [tab, setTab] = useState<SettingsTab>("general");
  const [draft, setDraft] = useState<AppSettingsDraft>(
    DEFAULT_APP_SETTINGS_DRAFT,
  );

  const setField: SetAppSettingsField = useCallback((key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

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
      setDraft(settingsToDraft(settings));
    }
  }, [settings, modal.id]);

  // Live preview: apply theme changes immediately
  const handlePrimaryColorChange = useCallback(
    (color: PrimaryColor) => {
      setField("primaryColor", color);
      applyPrimaryColor(color);
    },
    [setField],
  );

  const handleNeutralColorChange = useCallback(
    (color: NeutralColor) => {
      setField("neutralColor", color);
      applyNeutralColor(color);
    },
    [setField],
  );

  const handleEditorWidthChange = useCallback(
    (width: EditorWidth) => {
      setField("editorWidth", width);
      applyEditorWidth(width);
    },
    [setField],
  );

  const handleUiDensityChange = useCallback(
    (density: UiDensity) => {
      setField("uiDensity", density);
      applyUiDensity(density);
    },
    [setField],
  );

  const handleHoleHighlightOpacityChange = useCallback(
    (opacity: number) => {
      setField("holeHighlightOpacity", opacity);
      applyHoleHighlightOpacity(opacity);
    },
    [setField],
  );

  // Revert live preview on cancel using the snapshot taken at dialog open
  const handleCancel = useCallback(() => {
    const saved = savedSettingsRef.current;
    if (saved) {
      applyPrimaryColor(saved.primaryColor);
      applyNeutralColor(saved.neutralColor);
      applyEditorWidth(saved.editorWidth);
      applyUiDensity(saved.uiDensity);
      applyHoleHighlightOpacity(saved.holeHighlightOpacity);
    }
    closeModal();
  }, [closeModal]);

  if (modal.id !== "app-settings") return null;

  const isDirty =
    settings != null && isDraftDirty(draft, settingsToDraft(settings));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await updateAppSettings(draftToUpdatePayload(draft));
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
            draft={draft}
            setField={setField}
            onPrimaryColorChange={handlePrimaryColorChange}
            onNeutralColorChange={handleNeutralColorChange}
            onEditorWidthChange={handleEditorWidthChange}
            onUiDensityChange={handleUiDensityChange}
          />
        )}

        {tab === "editor" && (
          <EditorSettings
            draft={draft}
            setField={setField}
            onHoleHighlightOpacityChange={handleHoleHighlightOpacityChange}
            onManageDictionaries={() => openModal({ id: "dictionary-manager" })}
            onManageGrammarRules={() => openModal({ id: "grammar-rules" })}
          />
        )}

        {tab === "ai" && (
          <div className="space-y-6">
            <AiSettings draft={draft} setField={setField} />
          </div>
        )}

        {tab === "data" && (
          <BackupSettings
            onImportReady={(backup, filename) =>
              openModal({ id: "import-backup", backup, filename })
            }
          />
        )}

        <DialogFooter
          onCancel={handleCancel}
          submitLabel="Save"
          submitDisabled={!isDirty}
        />
      </form>
    </Modal>
  );
}
