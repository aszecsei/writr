import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { updateAppSettings } from "@/db/operations";
import { type CheckerSlice, createCheckerSlice } from "./createCheckerStore";

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

interface SpellcheckState
  extends CheckerSlice<MisspelledWord, ContextMenuState> {
  enabled: boolean;
  toggleEnabled: () => void;
  /** Mirrors `enabled` from the persisted AppSettings.spellcheckEnabled value. */
  setEnabled: (enabled: boolean) => void;
}

export const useSpellcheckStore = create<SpellcheckState>()(
  immer((set, get, api) => ({
    ...createCheckerSlice<MisspelledWord, ContextMenuState, SpellcheckState>()(
      set,
      get,
      api,
    ),

    enabled: true,

    toggleEnabled: () => {
      const next = !get().enabled;
      set((s) => {
        s.enabled = next;
      });
      void updateAppSettings({ spellcheckEnabled: next });
    },

    setEnabled: (enabled: boolean) =>
      set((s) => {
        s.enabled = enabled;
      }),
  })),
);
