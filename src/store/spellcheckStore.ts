import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
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
}

export const useSpellcheckStore = create<SpellcheckState>()(
  immer((set, get, api) => ({
    ...createCheckerSlice<MisspelledWord, ContextMenuState, SpellcheckState>()(
      set,
      get,
      api,
    ),

    enabled: true,

    toggleEnabled: () =>
      set((s) => {
        s.enabled = !s.enabled;
      }),
  })),
);
