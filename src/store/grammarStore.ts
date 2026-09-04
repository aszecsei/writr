import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { GrammarResult } from "@/lib/grammar";
import { type CheckerSlice, createCheckerSlice } from "./createCheckerStore";

export interface GrammarContextMenuState {
  result: GrammarResult;
  rect: DOMRect;
}

interface GrammarState
  extends CheckerSlice<GrammarResult, GrammarContextMenuState> {
  removeIssuesByRule: (ruleKey: string) => void;
}

export const useGrammarStore = create<GrammarState>()(
  immer((set, get, api) => ({
    ...createCheckerSlice<
      GrammarResult,
      GrammarContextMenuState,
      GrammarState
    >()(set, get, api),

    // Drop every issue from this rule, not just the current one.
    removeIssuesByRule: (ruleKey) =>
      set((s) => {
        s.scanner.items = s.scanner.items.filter(
          (issue) => issue.ruleKey !== ruleKey,
        );
        if (s.scanner.currentIndex >= s.scanner.items.length) {
          s.scanner.currentIndex = Math.max(0, s.scanner.items.length - 1);
        }
      }),
  })),
);
