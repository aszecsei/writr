import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { ProjectId } from "@/db/schemas";

interface ProjectState {
  activeProjectId: ProjectId | null;

  setActiveProject: (id: ProjectId) => void;
  clearActiveProject: () => void;
}

export const useProjectStore = create<ProjectState>()(
  immer((set) => ({
    activeProjectId: null,

    setActiveProject: (id) =>
      set((s) => {
        s.activeProjectId = id;
      }),

    clearActiveProject: () =>
      set((s) => {
        s.activeProjectId = null;
      }),
  })),
);
