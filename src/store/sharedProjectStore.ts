import { create } from "zustand";
import type { Project } from "@/db/schemas";
import {
  PROJECT_DOC_TABLES,
  type ProjectDocEntity,
  type ProjectDocMeta,
  type ProjectDocTable,
} from "@/lib/collab/projectDoc";

type SharedProjectByTable = {
  [K in ProjectDocTable]: Map<string, ProjectDocEntity<K>>;
};

export interface SharedProjectState {
  meta: ProjectDocMeta | null;
  project: Project | null;
  byTable: SharedProjectByTable;

  setMeta: (meta: ProjectDocMeta | null) => void;
  setProject: (project: Project | null) => void;
  upsertEntity: <T extends ProjectDocTable>(
    table: T,
    row: ProjectDocEntity<T>,
  ) => void;
  removeEntity: (table: ProjectDocTable, id: string) => void;
  bulkSeed: (
    rows: Partial<{ [K in ProjectDocTable]: ProjectDocEntity<K>[] }>,
    opts?: { project?: Project | null; meta?: ProjectDocMeta | null },
  ) => void;
  reset: () => void;
}

function emptyByTable(): SharedProjectByTable {
  const out = {} as SharedProjectByTable;
  for (const table of PROJECT_DOC_TABLES) {
    (out as Record<string, Map<string, unknown>>)[table] = new Map();
  }
  return out;
}

const INITIAL: Pick<SharedProjectState, "meta" | "project" | "byTable"> = {
  meta: null,
  project: null,
  byTable: emptyByTable(),
};

export const useSharedProjectStore = create<SharedProjectState>()((set) => ({
  ...INITIAL,
  setMeta: (meta) => set({ meta }),
  setProject: (project) => set({ project }),
  upsertEntity: (table, row) =>
    set((s) => {
      const existing = s.byTable[table];
      const next = new Map(
        existing as Map<string, unknown>,
      ) as SharedProjectByTable[typeof table];
      const id = (row as { id: string }).id;
      (next as Map<string, typeof row>).set(id, row);
      return {
        byTable: { ...s.byTable, [table]: next } as SharedProjectByTable,
      };
    }),
  removeEntity: (table, id) =>
    set((s) => {
      const existing = s.byTable[table];
      if (!existing.has(id)) return {};
      const next = new Map(
        existing as Map<string, unknown>,
      ) as SharedProjectByTable[typeof table];
      next.delete(id);
      return {
        byTable: { ...s.byTable, [table]: next } as SharedProjectByTable,
      };
    }),
  bulkSeed: (rows, opts) =>
    set(() => {
      const byTable = emptyByTable();
      for (const table of PROJECT_DOC_TABLES) {
        const provided = rows[table];
        if (!provided) continue;
        for (const row of provided) {
          const id = (row as { id: string }).id;
          (byTable[table] as Map<string, typeof row>).set(id, row);
        }
      }
      return {
        byTable,
        project: opts?.project ?? null,
        meta: opts?.meta ?? null,
      };
    }),
  reset: () => set({ ...INITIAL, byTable: emptyByTable() }),
}));
