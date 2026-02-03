import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type SidebarPanel = "chapters" | "bible";
export type ModalId =
  | "create-project"
  | "edit-project"
  | "delete-project"
  | "project-settings"
  | "app-settings"
  | "export"
  | "preview-card"
  | null;

interface UiState {
  sidebarOpen: boolean;
  sidebarPanel: SidebarPanel;
  activeModal: ModalId;
  modalData: Record<string, unknown>;
  aiPanelOpen: boolean;
  focusModeEnabled: boolean;

  toggleSidebar: () => void;
  setSidebarPanel: (panel: SidebarPanel) => void;
  openModal: (id: ModalId, data?: Record<string, unknown>) => void;
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
    activeModal: null,
    modalData: {},
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

    openModal: (id, data = {}) =>
      set((s) => {
        s.activeModal = id;
        s.modalData = data;
      }),

    closeModal: () =>
      set((s) => {
        s.activeModal = null;
        s.modalData = {};
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
