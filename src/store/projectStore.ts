import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { ChapterId, ProjectId, ProjectMode } from "@/db/schemas";

interface ProjectState {
  activeProjectId: ProjectId | null;
  activeProjectTitle: string | null;
  activeProjectMode: ProjectMode | null;
  activeChapterId: ChapterId | null;
  chapterOrder: ChapterId[];

  setActiveProject: (id: ProjectId, title: string, mode: ProjectMode) => void;
  clearActiveProject: () => void;
  setActiveChapter: (id: ChapterId | null) => void;
  setChapterOrder: (ids: ChapterId[]) => void;
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
