import type * as Y from "yjs";
import type { SharedProjectState } from "@/store/sharedProjectStore";
import {
  getProjectMeta,
  getProjectRow,
  getProjectTable,
  PROJECT_DOC_TABLES,
  type ProjectDocEntity,
  type ProjectDocTable,
  readEntity,
  readProjectMeta,
  readProjectRow,
} from "./projectDoc";

interface SharedProjectStoreApi {
  getState(): SharedProjectState;
  setState(
    partial:
      | Partial<SharedProjectState>
      | ((s: SharedProjectState) => Partial<SharedProjectState>),
  ): void;
}

interface AttachProjectReaderOptions {
  doc: Y.Doc;
  store: SharedProjectStoreApi;
}

/**
 * Wires the project Y.Doc into the shared project store: every meta /
 * row / table change pushes deltas into Zustand actions so React can
 * observe them via the existing selectors. Returns a detach function
 * that unsubscribes every observer; call it on session end.
 *
 * Initial state is materialized synchronously by reading whatever is
 * already in the doc (e.g. after an early buffer replay).
 */
export function attachProjectReader(
  opts: AttachProjectReaderOptions,
): () => void {
  const { doc, store } = opts;
  const state = store.getState();

  // Seed the store from whatever is already in the doc on attach.
  const seedTables: Partial<{
    [K in ProjectDocTable]: ProjectDocEntity<K>[];
  }> = {};
  for (const table of PROJECT_DOC_TABLES) {
    const map = getProjectTable(doc, table);
    if (map.size === 0) continue;
    const rows: ProjectDocEntity<typeof table>[] = [];
    for (const id of map.keys()) {
      const parsed = readEntity(doc, table, id);
      if (parsed) rows.push(parsed);
    }
    if (rows.length > 0) {
      (seedTables as Record<string, ProjectDocEntity<ProjectDocTable>[]>)[
        table
      ] = rows;
    }
  }
  state.bulkSeed(seedTables, {
    project: readProjectRow(doc),
    meta: readProjectMeta(doc),
  });

  const unsubs: Array<() => void> = [];

  // Meta observer
  const metaMap = getProjectMeta(doc);
  const metaHandler = () => {
    store.getState().setMeta(readProjectMeta(doc));
  };
  metaMap.observe(metaHandler);
  unsubs.push(() => metaMap.unobserve(metaHandler));

  // Project row observer
  const projectMap = getProjectRow(doc);
  const projectHandler = () => {
    store.getState().setProject(readProjectRow(doc));
  };
  projectMap.observe(projectHandler);
  unsubs.push(() => projectMap.unobserve(projectHandler));

  // Per-table observers: dispatch upsert/remove on each key change.
  for (const table of PROJECT_DOC_TABLES) {
    const map = getProjectTable(doc, table);
    const handler = (event: Y.YMapEvent<string>) => {
      const api = store.getState();
      for (const [key, info] of event.changes.keys.entries()) {
        if (info.action === "delete") {
          api.removeEntity(table, key);
        } else {
          const row = readEntity(doc, table, key);
          if (row) {
            (
              api.upsertEntity as (
                t: ProjectDocTable,
                r: ProjectDocEntity<ProjectDocTable>,
              ) => void
            )(table, row);
          }
        }
      }
    };
    map.observe(handler);
    unsubs.push(() => map.unobserve(handler));
  }

  return () => {
    for (const off of unsubs) off();
  };
}
