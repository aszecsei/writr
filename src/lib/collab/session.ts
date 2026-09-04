import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";
import * as Y from "yjs";
import type { CollabClient } from "./client";
import { CLOSE_CODES, type DocKind } from "./protocol";

export const REMOTE_ORIGIN = Symbol("writr-collab-remote");

export interface CollabSessionOptions {
  client: CollabClient;
}

interface DocEntry {
  doc: Y.Doc;
  detachUpdate: () => void;
}

export class CollabSession {
  readonly client: CollabClient;
  readonly awareness: Awareness;
  private readonly sessionDoc: Y.Doc;
  private readonly docs = new Map<DocKind, DocEntry>();
  private readonly clientUnsubs: Array<() => void> = [];
  private destroyed = false;

  constructor(opts: CollabSessionOptions) {
    this.client = opts.client;
    this.sessionDoc = new Y.Doc();
    this.awareness = new Awareness(this.sessionDoc);
    this.bindClient();
    this.bindAwareness();
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  getDoc(docKind: DocKind): Y.Doc {
    const existing = this.docs.get(docKind);
    if (existing) return existing.doc;
    return this.createDoc(docKind);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const off of this.clientUnsubs) off();
    this.clientUnsubs.length = 0;
    for (const entry of this.docs.values()) {
      entry.detachUpdate();
      entry.doc.destroy();
    }
    this.docs.clear();
    this.awareness.destroy();
    this.sessionDoc.destroy();
    // Close the client so the server sees the disconnect and can run room
    // cleanup (Room.detach → destroy("host_left") when no other peers remain).
    // Idempotent: client.close() is a no-op if already closed.
    this.client.close(CLOSE_CODES.NORMAL, "session-destroyed");
  }

  private createDoc(docKind: DocKind): Y.Doc {
    const doc = new Y.Doc();
    const handler = (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE_ORIGIN) return;
      void this.client.sendYUpdate(docKind, update);
    };
    doc.on("update", handler);
    this.docs.set(docKind, {
      doc,
      detachUpdate: () => {
        doc.off("update", handler);
      },
    });
    return doc;
  }

  private bindClient(): void {
    this.clientUnsubs.push(
      this.client.on("buffer", ({ docKind, updates }) => {
        const doc = this.getDoc(docKind);
        doc.transact(() => {
          for (const update of updates) {
            Y.applyUpdate(doc, update, REMOTE_ORIGIN);
          }
        }, REMOTE_ORIGIN);
      }),
    );

    this.clientUnsubs.push(
      this.client.on("y-update", ({ docKind, update }) => {
        const doc = this.getDoc(docKind);
        Y.applyUpdate(doc, update, REMOTE_ORIGIN);
      }),
    );

    this.clientUnsubs.push(
      this.client.on("awareness", ({ update }) => {
        applyAwarenessUpdate(this.awareness, update, REMOTE_ORIGIN);
      }),
    );
  }

  private bindAwareness(): void {
    const handler = (
      changes: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      if (origin === REMOTE_ORIGIN) return;
      const changedClients = changes.added
        .concat(changes.updated)
        .concat(changes.removed);
      if (changedClients.length === 0) return;
      const update = encodeAwarenessUpdate(this.awareness, changedClients);
      void this.client.sendAwareness(update);
    };
    this.awareness.on("update", handler);
    this.clientUnsubs.push(() => {
      this.awareness.off("update", handler);
    });
  }
}
