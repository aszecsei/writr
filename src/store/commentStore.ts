import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { CommentId } from "@/db/schemas";

interface CommentState {
  selectedId: CommentId | null;
  marginVisible: boolean;

  selectComment: (id: CommentId | null) => void;
  clearSelection: () => void;
  toggleMargin: () => void;
  setMarginVisible: (visible: boolean) => void;
}

export const useCommentStore = create<CommentState>()(
  immer((set) => ({
    selectedId: null,
    marginVisible: true,

    selectComment: (id) =>
      set((s) => {
        s.selectedId = id;
      }),

    clearSelection: () =>
      set((s) => {
        s.selectedId = null;
      }),

    toggleMargin: () =>
      set((s) => {
        s.marginVisible = !s.marginVisible;
      }),

    setMarginVisible: (visible) =>
      set((s) => {
        s.marginVisible = visible;
      }),
  })),
);
