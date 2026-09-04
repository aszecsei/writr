import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface SprintState {
  elapsedMs: number;
  remainingMs: number;
  wordsWritten: number;

  updateTimer: (elapsedMs: number, remainingMs: number) => void;
  setWordsWritten: (words: number) => void;
  reset: () => void;
}

export const useSprintStore = create<SprintState>()(
  immer((set) => ({
    elapsedMs: 0,
    remainingMs: 0,
    wordsWritten: 0,

    updateTimer: (elapsedMs, remainingMs) =>
      set((s) => {
        s.elapsedMs = elapsedMs;
        s.remainingMs = remainingMs;
      }),

    setWordsWritten: (words) =>
      set((s) => {
        s.wordsWritten = words;
      }),

    reset: () =>
      set((s) => {
        s.elapsedMs = 0;
        s.remainingMs = 0;
        s.wordsWritten = 0;
      }),
  })),
);
