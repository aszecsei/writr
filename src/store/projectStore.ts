import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface ProjectState {
  activeProjectId: string | null;
  activeProjectTitle: string | null;
  activeChapterId: string | null;
  chapterOrder: string[];

  setActiveProject: (id: string, title: string) => void;
  clearActiveProject: () => void;
  setActiveChapter: (id: string | null) => void;
  setChapterOrder: (ids: string[]) => void;
}

export const useProjectStore = create<ProjectState>()(
  immer((set) => ({
    activeProjectId: null,
    activeProjectTitle: null,
    activeChapterId: null,
    chapterOrder: [],

    setActiveProject: (id, title) =>
      set((s) => {
        s.activeProjectId = id;
        s.activeProjectTitle = title;
      }),

    clearActiveProject: () =>
      set((s) => {
        s.activeProjectId = null;
        s.activeProjectTitle = null;
        s.activeChapterId = null;
        s.chapterOrder = [];
      }),

    setActiveChapter: (id) =>
      set((s) => {
        s.activeChapterId = id;
      }),

    setChapterOrder: (ids) =>
      set((s) => {
        s.chapterOrder = ids;
      }),
  })),
);
