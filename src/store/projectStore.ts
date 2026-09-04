import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { ProjectId, ProjectMode } from "@/db/schemas";

interface ProjectState {
  activeProjectId: ProjectId | null;
  activeProjectTitle: string | null;
  activeProjectMode: ProjectMode | null;

  setActiveProject: (id: ProjectId, title: string, mode: ProjectMode) => void;
  clearActiveProject: () => void;
}

export const useProjectStore = create<ProjectState>()(
  immer((set) => ({
    activeProjectId: null,
    activeProjectTitle: null,
    activeProjectMode: null,

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
      }),
  })),
);
