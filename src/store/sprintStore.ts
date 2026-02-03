import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface SprintState {
  activeSprintId: string | null;
  isRunning: boolean;
  isPaused: boolean;
  elapsedMs: number;
  remainingMs: number;
  wordsWritten: number;
  configModalOpen: boolean;
  historyModalOpen: boolean;

  setActiveSprint: (
    id: string | null,
    isRunning: boolean,
    isPaused: boolean,
  ) => void;
  updateTimer: (elapsedMs: number, remainingMs: number) => void;
  setWordsWritten: (words: number) => void;
  openConfigModal: () => void;
  closeConfigModal: () => void;
  openHistoryModal: () => void;
  closeHistoryModal: () => void;
  reset: () => void;
}

export const useSprintStore = create<SprintState>()(
  immer((set) => ({
    activeSprintId: null,
    isRunning: false,
    isPaused: false,
    elapsedMs: 0,
    remainingMs: 0,
    wordsWritten: 0,
    configModalOpen: false,
    historyModalOpen: false,

    setActiveSprint: (id, isRunning, isPaused) =>
      set((s) => {
        s.activeSprintId = id;
        s.isRunning = isRunning;
        s.isPaused = isPaused;
      }),

    updateTimer: (elapsedMs, remainingMs) =>
      set((s) => {
        s.elapsedMs = elapsedMs;
        s.remainingMs = remainingMs;
      }),

    setWordsWritten: (words) =>
      set((s) => {
        s.wordsWritten = words;
      }),

    openConfigModal: () =>
      set((s) => {
        s.configModalOpen = true;
      }),

    closeConfigModal: () =>
      set((s) => {
        s.configModalOpen = false;
      }),

    openHistoryModal: () =>
      set((s) => {
        s.historyModalOpen = true;
      }),

    closeHistoryModal: () =>
      set((s) => {
        s.historyModalOpen = false;
      }),

    reset: () =>
      set((s) => {
        s.activeSprintId = null;
        s.isRunning = false;
        s.isPaused = false;
        s.elapsedMs = 0;
        s.remainingMs = 0;
        s.wordsWritten = 0;
      }),
  })),
);
