import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

type FindReplaceMode = "find" | "find-replace";

interface FindReplaceState {
  isOpen: boolean;
  mode: FindReplaceMode;
  focusTrigger: number;
  searchTerm: string;
  replaceTerm: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  matchCount: number;
  currentMatch: number;

  // Actions
  openFind: () => void;
  openFindReplace: () => void;
  close: () => void;
  toggleMode: () => void;
  setSearchTerm: (term: string) => void;
  setReplaceTerm: (term: string) => void;
  toggleCaseSensitive: () => void;
  toggleWholeWord: () => void;
  toggleUseRegex: () => void;
  setMatchInfo: (count: number, current: number) => void;
}

export const useFindReplaceStore = create<FindReplaceState>()(
  immer((set) => ({
    isOpen: false,
    mode: "find" as FindReplaceMode,
    focusTrigger: 0,
    searchTerm: "",
    replaceTerm: "",
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
    matchCount: 0,
    currentMatch: 0,

    openFind: () =>
      set((s) => {
        s.isOpen = true;
        s.mode = "find";
        s.focusTrigger += 1;
      }),

    openFindReplace: () =>
      set((s) => {
        s.isOpen = true;
        s.mode = "find-replace";
        s.focusTrigger += 1;
      }),

    close: () =>
      set((s) => {
        s.isOpen = false;
        s.searchTerm = "";
        s.replaceTerm = "";
        s.matchCount = 0;
        s.currentMatch = 0;
      }),

    toggleMode: () =>
      set((s) => {
        s.mode = s.mode === "find" ? "find-replace" : "find";
      }),

    setSearchTerm: (term) =>
      set((s) => {
        s.searchTerm = term;
      }),

    setReplaceTerm: (term) =>
      set((s) => {
        s.replaceTerm = term;
      }),

    toggleCaseSensitive: () =>
      set((s) => {
        s.caseSensitive = !s.caseSensitive;
      }),

    toggleWholeWord: () =>
      set((s) => {
        s.wholeWord = !s.wholeWord;
      }),

    toggleUseRegex: () =>
      set((s) => {
        s.useRegex = !s.useRegex;
      }),

    setMatchInfo: (count, current) =>
      set((s) => {
        s.matchCount = count;
        s.currentMatch = current;
      }),
  })),
);
