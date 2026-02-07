import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type SidebarPanel = "chapters" | "bible";

// Discriminated union for modal state - provides type safety at call sites
export type ModalState =
  | { id: null }
  | { id: "create-project" }
  | { id: "edit-project"; projectId: string }
  | { id: "delete-project"; projectId: string }
  | { id: "project-settings" }
  | { id: "app-settings" }
  | {
      id: "export";
      projectId: string;
      chapterId?: string;
      scope?: "book" | "chapter";
    }
  | {
      id: "preview-card";
      selectedHtml: string;
      projectTitle: string;
      chapterTitle: string;
    }
  | { id: "link-editor"; currentHref?: string }
  | { id: "insert-image" }
  | { id: "ruby-editor"; currentAnnotation?: string }
  | { id: "dictionary-manager" }
  | { id: "version-history"; chapterId: string; projectId: string };

export type ModalId = ModalState["id"];

interface UiState {
  sidebarOpen: boolean;
  sidebarPanel: SidebarPanel;
  modal: ModalState;
  aiPanelOpen: boolean;
  focusModeEnabled: boolean;

  toggleSidebar: () => void;
  setSidebarPanel: (panel: SidebarPanel) => void;
  openModal: <T extends ModalState>(modal: T) => void;
  closeModal: () => void;
  toggleAiPanel: () => void;
  closeAiPanel: () => void;
  toggleFocusMode: () => void;
  setFocusMode: (enabled: boolean) => void;
}

export const useUiStore = create<UiState>()(
  immer((set) => ({
    sidebarOpen: true,
    sidebarPanel: "chapters",
    modal: { id: null },
    aiPanelOpen: false,
    focusModeEnabled: false,

    toggleSidebar: () =>
      set((s) => {
        s.sidebarOpen = !s.sidebarOpen;
      }),

    setSidebarPanel: (panel) =>
      set((s) => {
        s.sidebarPanel = panel;
      }),

    openModal: (modal) =>
      set((s) => {
        s.modal = modal;
      }),

    closeModal: () =>
      set((s) => {
        s.modal = { id: null };
      }),

    toggleAiPanel: () =>
      set((s) => {
        s.aiPanelOpen = !s.aiPanelOpen;
      }),

    closeAiPanel: () =>
      set((s) => {
        s.aiPanelOpen = false;
      }),

    toggleFocusMode: () =>
      set((s) => {
        s.focusModeEnabled = !s.focusModeEnabled;
      }),

    setFocusMode: (enabled) =>
      set((s) => {
        s.focusModeEnabled = enabled;
      }),
  })),
);

// Type guard helpers for narrowing modal state
export function isEditProjectModal(
  modal: ModalState,
): modal is { id: "edit-project"; projectId: string } {
  return modal.id === "edit-project";
}

export function isDeleteProjectModal(
  modal: ModalState,
): modal is { id: "delete-project"; projectId: string } {
  return modal.id === "delete-project";
}

export function isExportModal(modal: ModalState): modal is {
  id: "export";
  projectId: string;
  chapterId?: string;
  scope?: "book" | "chapter";
} {
  return modal.id === "export";
}

export function isPreviewCardModal(modal: ModalState): modal is {
  id: "preview-card";
  selectedHtml: string;
  projectTitle: string;
  chapterTitle: string;
} {
  return modal.id === "preview-card";
}

export function isLinkEditorModal(
  modal: ModalState,
): modal is { id: "link-editor"; currentHref?: string } {
  return modal.id === "link-editor";
}

export function isRubyEditorModal(
  modal: ModalState,
): modal is { id: "ruby-editor"; currentAnnotation?: string } {
  return modal.id === "ruby-editor";
}

export function isVersionHistoryModal(
  modal: ModalState,
): modal is { id: "version-history"; chapterId: string; projectId: string } {
  return modal.id === "version-history";
}
