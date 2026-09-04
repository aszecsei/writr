import { enableMapSet } from "immer";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

enableMapSet();

export interface MisspelledWord {
  word: string;
  from: number;
  to: number;
  suggestions: string[];
}

export interface ContextMenuState {
  word: string;
  from: number;
  to: number;
  suggestions: string[];
  rect: DOMRect;
}

interface ScannerState {
  currentIndex: number;
  misspellings: MisspelledWord[];
}

interface SpellcheckState {
  enabled: boolean;
  ignoredWords: Set<string>;

  // Context menu state
  contextMenu: ContextMenuState | null;

  // Scanner modal state
  scannerOpen: boolean;
  scanner: ScannerState;

  // Actions
  toggleEnabled: () => void;
  addToIgnored: (word: string) => void;
  openContextMenu: (state: ContextMenuState) => void;
  closeContextMenu: () => void;
  openScanner: (misspellings: MisspelledWord[]) => void;
  closeScanner: () => void;
  nextMisspelling: () => void;
  prevMisspelling: () => void;
  removeMisspellingAt: (index: number) => void;
}

export const useSpellcheckStore = create<SpellcheckState>()(
  immer((set) => ({
    enabled: true,
    ignoredWords: new Set<string>(),
    contextMenu: null,
    scannerOpen: false,
    scanner: {
      currentIndex: 0,
      misspellings: [],
    },

    toggleEnabled: () =>
      set((s) => {
        s.enabled = !s.enabled;
      }),

    addToIgnored: (word) =>
      set((s) => {
        s.ignoredWords.add(word.toLowerCase());
      }),

    openContextMenu: (state) =>
      set((s) => {
        s.contextMenu = state;
      }),

    closeContextMenu: () =>
      set((s) => {
        s.contextMenu = null;
      }),

    openScanner: (misspellings) =>
      set((s) => {
        s.scannerOpen = true;
        s.scanner = {
          currentIndex: 0,
          misspellings,
        };
      }),

    closeScanner: () =>
      set((s) => {
        s.scannerOpen = false;
        s.scanner = {
          currentIndex: 0,
          misspellings: [],
        };
      }),

    nextMisspelling: () =>
      set((s) => {
        if (s.scanner.misspellings.length === 0) return;
        s.scanner.currentIndex =
          (s.scanner.currentIndex + 1) % s.scanner.misspellings.length;
      }),

    prevMisspelling: () =>
      set((s) => {
        if (s.scanner.misspellings.length === 0) return;
        s.scanner.currentIndex =
          (s.scanner.currentIndex - 1 + s.scanner.misspellings.length) %
          s.scanner.misspellings.length;
      }),

    removeMisspellingAt: (index) =>
      set((s) => {
        if (index >= 0 && index < s.scanner.misspellings.length) {
          s.scanner.misspellings.splice(index, 1);
          // Adjust current index if needed
          if (s.scanner.currentIndex >= s.scanner.misspellings.length) {
            s.scanner.currentIndex = Math.max(
              0,
              s.scanner.misspellings.length - 1,
            );
          }
        }
      }),
  })),
);
