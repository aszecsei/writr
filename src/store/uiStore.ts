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
  | { id: "version-history"; chapterId: string; projectId: string }
  | { id: "ai-config" };

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

// Type guard factory for narrowing modal state by id
function createModalGuard<Id extends ModalId>(id: Id) {
  return (modal: ModalState): modal is Extract<ModalState, { id: Id }> =>
    modal.id === id;
}

export const isEditProjectModal = createModalGuard("edit-project");
export const isDeleteProjectModal = createModalGuard("delete-project");
export const isExportModal = createModalGuard("export");
export const isPreviewCardModal = createModalGuard("preview-card");
export const isLinkEditorModal = createModalGuard("link-editor");
export const isRubyEditorModal = createModalGuard("ruby-editor");
export const isVersionHistoryModal = createModalGuard("version-history");
