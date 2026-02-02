import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type SidebarPanel = "chapters" | "bible" | "settings";
export type ModalId =
  | "create-project"
  | "delete-project"
  | "project-settings"
  | "app-settings"
  | "export"
  | null;

interface UiState {
  sidebarOpen: boolean;
  sidebarPanel: SidebarPanel;
  activeModal: ModalId;
  modalData: Record<string, unknown>;
  aiPanelOpen: boolean;

  toggleSidebar: () => void;
  setSidebarPanel: (panel: SidebarPanel) => void;
  openModal: (id: ModalId, data?: Record<string, unknown>) => void;
  closeModal: () => void;
  toggleAiPanel: () => void;
}

export const useUiStore = create<UiState>()(
  immer((set) => ({
    sidebarOpen: true,
    sidebarPanel: "chapters",
    activeModal: null,
    modalData: {},
    aiPanelOpen: false,

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
  })),
);
