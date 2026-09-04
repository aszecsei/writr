import type * as Y from "yjs";
import type { ChapterId, Project, ProjectId } from "@/db/schemas";
import {
  deleteEntity,
  getProjectTable,
  PROJECT_DOC_VERSION,
  type ProjectDocEntity,
  type ProjectDocTable,
  upsertEntity,
  writeProjectMeta,
  writeProjectRow,
} from "./projectDoc";

export const MIRROR_ORIGIN = Symbol("writr-collab-project-mirror");

export type ProjectSnapshot = {
  project: Project;
  activeChapterId: ChapterId | null;
} & {
  [K in ProjectDocTable]: ProjectDocEntity<K>[];
};

interface ProjectMirrorOptions {
  doc: Y.Doc;
  projectId: ProjectId;
}

/**
 * Diffs Dexie-backed project state into the project Y.Doc on demand.
 * Stateful per-table row hashes track what's already in the doc so each
 * call only emits the minimum upserts/deletes.
 */
export class ProjectMirror {
  readonly doc: Y.Doc;
  readonly projectId: ProjectId;
  private readonly hashes: Map<ProjectDocTable, Map<string, string>> =
    new Map();
  private projectHash: string | null = null;
  private revision = 0;
  private destroyed = false;

  constructor(opts: ProjectMirrorOptions) {
    this.doc = opts.doc;
    this.projectId = opts.projectId;
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  /**
   * Replace every table and meta field with a complete snapshot. Use on
   * mount and after a buffer-compaction rotate. Bumps the revision so
   * downstream observers know a fresh seed has landed.
   */
  seedFromSnapshot(snapshot: ProjectSnapshot): void {
    if (this.destroyed) return;
    this.doc.transact(() => {
      this.writeProject(snapshot.project);
      for (const table of TABLE_KEYS) {
        this.replaceTable(table, snapshot[table]);
      }
      this.revision += 1;
      writeProjectMeta(
        this.doc,
        {
          mode: "project",
          projectId: this.projectId,
          activeChapterId: snapshot.activeChapterId,
          revision: this.revision,
          version: PROJECT_DOC_VERSION,
        },
        MIRROR_ORIGIN,
      );
    }, MIRROR_ORIGIN);
  }

  /**
   * Diff the supplied rows against what's already in the doc for `table`.
   * Upserts only changed rows (per JSON hash) and deletes rows that are
   * absent from the new set.
   */
  syncTable<T extends ProjectDocTable>(
    table: T,
    rows: ProjectDocEntity<T>[],
  ): void {
    if (this.destroyed) return;
    const previousHashes = this.hashes.get(table) ?? new Map<string, string>();
    const nextHashes = new Map<string, string>();
    const upserts: ProjectDocEntity<T>[] = [];

    for (const row of rows) {
      const id = (row as { id: string }).id;
      const json = JSON.stringify(row);
      nextHashes.set(id, json);
      if (previousHashes.get(id) !== json) {
        upserts.push(row);
      }
    }

    const deletions: string[] = [];
    for (const id of previousHashes.keys()) {
      if (!nextHashes.has(id)) deletions.push(id);
    }

    if (upserts.length === 0 && deletions.length === 0) {
      this.hashes.set(table, nextHashes);
      return;
    }

    this.doc.transact(() => {
      for (const row of upserts) {
        upsertEntity(this.doc, table, row, MIRROR_ORIGIN);
      }
      for (const id of deletions) {
        deleteEntity(this.doc, table, id, MIRROR_ORIGIN);
      }
    }, MIRROR_ORIGIN);

    this.hashes.set(table, nextHashes);
  }

  /** Update only the project row. Idempotent on JSON hash. */
  syncProject(project: Project): void {
    if (this.destroyed) return;
    this.writeProject(project);
  }

  setActiveChapterId(id: ChapterId | null): void {
    if (this.destroyed) return;
    writeProjectMeta(this.doc, { activeChapterId: id }, MIRROR_ORIGIN);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.hashes.clear();
    this.projectHash = null;
  }

  private writeProject(project: Project): void {
    const json = JSON.stringify(project);
    if (this.projectHash === json) return;
    writeProjectRow(this.doc, project, MIRROR_ORIGIN);
    this.projectHash = json;
  }

  private replaceTable<T extends ProjectDocTable>(
    table: T,
    rows: ProjectDocEntity<T>[],
  ): void {
    const map = getProjectTable(this.doc, table);
    const nextHashes = new Map<string, string>();
    const seen = new Set<string>();
    for (const row of rows) {
      const id = (row as { id: string }).id;
      seen.add(id);
      const json = JSON.stringify(row);
      nextHashes.set(id, json);
      upsertEntity(this.doc, table, row, MIRROR_ORIGIN);
    }
    for (const id of [...map.keys()]) {
      if (!seen.has(id)) deleteEntity(this.doc, table, id, MIRROR_ORIGIN);
    }
    this.hashes.set(table, nextHashes);
  }
}

const TABLE_KEYS: ProjectDocTable[] = [
  "chapters",
  "characters",
  "characterRels",
  "locations",
  "worldbuilding",
  "timeline",
  "styleGuide",
  "guardrails",
  "outlineColumns",
  "outlineRows",
  "outlineCells",
];
