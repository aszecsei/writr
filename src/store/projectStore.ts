import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { ProjectMode } from "@/db/schemas";

interface ProjectState {
  activeProjectId: string | null;
  activeProjectTitle: string | null;
  activeProjectMode: ProjectMode | null;
  activeChapterId: string | null;
  chapterOrder: string[];

  setActiveProject: (id: string, title: string, mode: ProjectMode) => void;
  clearActiveProject: () => void;
  setActiveChapter: (id: string | null) => void;
  setChapterOrder: (ids: string[]) => void;
}

export const useProjectStore = create<ProjectState>()(
  immer((set) => ({
    activeProjectId: null,
    activeProjectTitle: null,
    activeProjectMode: null,
    activeChapterId: null,
    chapterOrder: [],

    setActiveProject: (id, title, mode) =>
      set((s) => {
        s.activeProjectId = id;
        s.activeProjectTitle = title;
        s.activeProjectMode = mode;
      }),

    clearActiveProject: () =>
      set((s) => {
        s.activeProjectId = null;
        s.activeProjectTitle = null;
        s.activeProjectMode = null;
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
