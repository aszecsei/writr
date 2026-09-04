import { enableMapSet } from "immer";
import type { StateCreator } from "zustand";

enableMapSet();

export interface CheckerScannerState<TItem> {
  currentIndex: number;
  items: TItem[];
}

export interface CheckerSlice<TItem, TContextMenu> {
  /** Session-only set of ignored keys (word text, or a rule-derived key — the caller decides). */
  ignored: Set<string>;

  contextMenu: TContextMenu | null;

  scanner: CheckerScannerState<TItem>;

  addToIgnored: (key: string) => void;
  openContextMenu: (state: TContextMenu) => void;
  closeContextMenu: () => void;
  openScanner: (items: TItem[]) => void;
  next: () => void;
  prev: () => void;
  removeAt: (index: number) => void;
}

type CheckerSliceCreator<
  TItem,
  TContextMenu,
  TState extends CheckerSlice<TItem, TContextMenu>,
> = StateCreator<
  TState,
  [["zustand/immer", never]],
  [],
  CheckerSlice<TItem, TContextMenu>
>;

/**
 * Shared slice for the spellcheck and grammar checker stores: a context menu,
 * a scanner (current index + item list) with wraparound next/prev navigation,
 * and a session-only set of ignored keys. Each store spreads this into its
 * own `create()` call alongside whatever domain-specific fields it needs.
 */
export function createCheckerSlice<
  TItem,
  TContextMenu,
  TState extends CheckerSlice<TItem, TContextMenu>,
>(): CheckerSliceCreator<TItem, TContextMenu, TState> {
  return (set) => ({
    ignored: new Set<string>(),
    contextMenu: null,
    scanner: { currentIndex: 0, items: [] },

    addToIgnored: (key) =>
      set((s) => {
        s.ignored.add(key);
      }),

    openContextMenu: (state) =>
      set((s) => {
        // Immer's Draft<T> can't be resolved for an unconstrained generic.
        s.contextMenu = state as never;
      }),

    closeContextMenu: () =>
      set((s) => {
        s.contextMenu = null;
      }),

    openScanner: (items) =>
      set((s) => {
        s.scanner = { currentIndex: 0, items: items as never };
      }),

    next: () =>
      set((s) => {
        if (s.scanner.items.length === 0) return;
        s.scanner.currentIndex =
          (s.scanner.currentIndex + 1) % s.scanner.items.length;
      }),

    prev: () =>
      set((s) => {
        if (s.scanner.items.length === 0) return;
        s.scanner.currentIndex =
          (s.scanner.currentIndex - 1 + s.scanner.items.length) %
          s.scanner.items.length;
      }),

    removeAt: (index) =>
      set((s) => {
        if (index < 0 || index >= s.scanner.items.length) return;
        s.scanner.items.splice(index, 1);
        if (s.scanner.currentIndex >= s.scanner.items.length) {
          s.scanner.currentIndex = Math.max(0, s.scanner.items.length - 1);
        }
      }),
  });
}
