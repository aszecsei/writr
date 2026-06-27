import { enableMapSet } from "immer";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { type GrammarResult, ignoreKey } from "@/lib/grammar";

enableMapSet();

export interface GrammarContextMenuState {
  result: GrammarResult;
  rect: DOMRect;
}

export interface GrammarScannerState {
  currentIndex: number;
  issues: GrammarResult[];
}

interface GrammarState {
  /** Session-only set of ignored lint keys (see {@link ignoreKey}). */
  ignoredLints: Set<string>;

  // Context menu state
  contextMenu: GrammarContextMenuState | null;

  // Scanner modal state
  scannerOpen: boolean;
  scanner: GrammarScannerState;

  // Actions
  ignoreLint: (kind: string, problemText: string) => void;
  clearIgnored: () => void;
  openContextMenu: (state: GrammarContextMenuState) => void;
  closeContextMenu: () => void;
  openScanner: (issues: GrammarResult[]) => void;
  closeScanner: () => void;
  nextIssue: () => void;
  prevIssue: () => void;
  setCurrentIssue: (index: number) => void;
  removeIssueAt: (index: number) => void;
  removeIssuesByRule: (ruleKey: string) => void;
}

export const useGrammarStore = create<GrammarState>()(
  immer((set) => ({
    ignoredLints: new Set<string>(),
    contextMenu: null,
    scannerOpen: false,
    scanner: {
      currentIndex: 0,
      issues: [],
    },

    ignoreLint: (kind, problemText) =>
      set((s) => {
        s.ignoredLints.add(ignoreKey(kind, problemText));
      }),

    clearIgnored: () =>
      set((s) => {
        s.ignoredLints.clear();
      }),

    openContextMenu: (state) =>
      set((s) => {
        s.contextMenu = state;
      }),

    closeContextMenu: () =>
      set((s) => {
        s.contextMenu = null;
      }),

    openScanner: (issues) =>
      set((s) => {
        s.scannerOpen = true;
        s.scanner = {
          currentIndex: 0,
          issues,
        };
      }),

    closeScanner: () =>
      set((s) => {
        s.scannerOpen = false;
        s.scanner = {
          currentIndex: 0,
          issues: [],
        };
      }),

    nextIssue: () =>
      set((s) => {
        if (s.scanner.issues.length === 0) return;
        s.scanner.currentIndex =
          (s.scanner.currentIndex + 1) % s.scanner.issues.length;
      }),

    prevIssue: () =>
      set((s) => {
        if (s.scanner.issues.length === 0) return;
        s.scanner.currentIndex =
          (s.scanner.currentIndex - 1 + s.scanner.issues.length) %
          s.scanner.issues.length;
      }),

    setCurrentIssue: (index) =>
      set((s) => {
        if (index >= 0 && index < s.scanner.issues.length) {
          s.scanner.currentIndex = index;
        }
      }),

    removeIssueAt: (index) =>
      set((s) => {
        if (index >= 0 && index < s.scanner.issues.length) {
          s.scanner.issues.splice(index, 1);
          if (s.scanner.currentIndex >= s.scanner.issues.length) {
            s.scanner.currentIndex = Math.max(0, s.scanner.issues.length - 1);
          }
        }
      }),

    removeIssuesByRule: (ruleKey) =>
      set((s) => {
        s.scanner.issues = s.scanner.issues.filter(
          (issue) => issue.ruleKey !== ruleKey,
        );
        if (s.scanner.currentIndex >= s.scanner.issues.length) {
          s.scanner.currentIndex = Math.max(0, s.scanner.issues.length - 1);
        }
      }),
  })),
);
