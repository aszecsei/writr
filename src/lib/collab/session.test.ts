import { beforeEach, describe, expect, it, vi } from "vitest";
import { Awareness, encodeAwarenessUpdate } from "y-protocols/awareness";
import * as Y from "yjs";
import { CollabClient } from "./client";
import {
  decryptPayload,
  encryptPayload,
  generateRoomKey,
  type RoomKey,
} from "./crypto";
import { CLOSE_CODES, type ServerMessage } from "./protocol";
import { CollabSession, REMOTE_ORIGIN } from "./session";
import { flush, MockTransport } from "./test-support";

async function deliver(
  client: CollabClient,
  message: ServerMessage,
): Promise<void> {
  await client.handleMessage(JSON.stringify(message));
}

let key: RoomKey;
beforeEach(async () => {
  key = await generateRoomKey();
});

describe("CollabSession: outgoing local edits", () => {
  it("sends encrypted y-update when local Y.Doc changes", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const session = new CollabSession({ client });

    const doc = session.getDoc("prose");
    doc.getText("body").insert(0, "hello");
    await flush();

    const sent = transport.sent.find((m) => m.type === "y-update");
    expect(sent?.type).toBe("y-update");
    if (sent?.type === "y-update") {
      expect(sent.docKind).toBe("prose");
      const updateBytes = await decryptPayload(key, sent.payload);
      const verify = new Y.Doc();
      Y.applyUpdate(verify, updateBytes);
      expect(verify.getText("body").toString()).toBe("hello");
    }
  });

  it("does not echo remote updates back to the server", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const session = new CollabSession({ client });

    const remoteDoc = new Y.Doc();
    remoteDoc.getText("body").insert(0, "remote");
    const update = Y.encodeStateAsUpdate(remoteDoc);
    const payload = await encryptPayload(key, update);

    await deliver(client, {
      type: "y-update",
      docKind: "prose",
      streamId: 1,
      payload,
      from: "peer-x",
    });
    await flush();

    expect(transport.sent.filter((m) => m.type === "y-update")).toHaveLength(0);
    expect(session.getDoc("prose").getText("body").toString()).toBe("remote");
  });
});

describe("CollabSession: incoming application", () => {
  it("applies single y-update to the matching Y.Doc", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "view" });
    const session = new CollabSession({ client });

    const remoteDoc = new Y.Doc();
    remoteDoc.getText("body").insert(0, "incoming");
    const payload = await encryptPayload(key, Y.encodeStateAsUpdate(remoteDoc));

    await deliver(client, {
      type: "y-update",
      docKind: "prose",
      streamId: 1,
      payload,
      from: "peer-x",
    });

    expect(session.getDoc("prose").getText("body").toString()).toBe("incoming");
  });

  it("replays buffer updates in order within a single transact tagged REMOTE_ORIGIN", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "view" });
    const session = new CollabSession({ client });

    const seedDoc = new Y.Doc();
    const text = seedDoc.getText("body");

    text.insert(0, "A");
    const u1 = await encryptPayload(key, Y.encodeStateAsUpdate(seedDoc));
    const stateAfterA = Y.encodeStateVector(seedDoc);

    text.insert(1, "B");
    const u2 = await encryptPayload(
      key,
      Y.encodeStateAsUpdate(seedDoc, stateAfterA),
    );
    const stateAfterB = Y.encodeStateVector(seedDoc);

    text.insert(2, "C");
    const u3 = await encryptPayload(
      key,
      Y.encodeStateAsUpdate(seedDoc, stateAfterB),
    );

    const doc = session.getDoc("prose");
    const origins: unknown[] = [];
    const handler = vi.fn((_update: Uint8Array, origin: unknown) => {
      origins.push(origin);
    });
    doc.on("update", handler);

    await deliver(client, {
      type: "buffer",
      docKind: "prose",
      streamId: 1,
      updates: [u1, u2, u3],
    });

    expect(doc.getText("body").toString()).toBe("ABC");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(origins).toEqual([REMOTE_ORIGIN]);
  });
});

describe("CollabSession: awareness", () => {
  it("sends encrypted awareness when setLocalState is called", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const session = new CollabSession({ client });

    session.awareness.setLocalState({ name: "Alice", cursor: 5 });
    await flush();

    const sent = transport.sent.find((m) => m.type === "awareness");
    expect(sent?.type).toBe("awareness");
  });

  it("applies remote awareness updates without echoing", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const session = new CollabSession({ client });

    const remoteDoc = new Y.Doc();
    const remoteAware = new Awareness(remoteDoc);
    remoteAware.setLocalState({ name: "Bob" });
    const update = encodeAwarenessUpdate(remoteAware, [remoteAware.clientID]);
    const payload = await encryptPayload(key, update);

    transport.sent = [];

    await deliver(client, {
      type: "awareness",
      payload,
      from: "peer-y",
    });
    await flush();

    expect(transport.sent.filter((m) => m.type === "awareness")).toHaveLength(
      0,
    );
    expect(session.awareness.getStates().get(remoteAware.clientID)).toEqual({
      name: "Bob",
    });
  });
});

describe("CollabSession: destroy", () => {
  it("stops dispatching local updates after destroy", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const session = new CollabSession({ client });

    const doc = session.getDoc("prose");
    session.destroy();

    doc.getText("body").insert(0, "hi");
    await flush();

    expect(transport.sent.filter((m) => m.type === "y-update")).toHaveLength(0);
    expect(session.isDestroyed).toBe(true);
  });

  it("is idempotent", () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const session = new CollabSession({ client });

    session.destroy();
    expect(() => session.destroy()).not.toThrow();
  });

  it("closes the underlying transport so the server can clean up the room", () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const session = new CollabSession({ client });

    session.destroy();

    expect(transport.closed).not.toBeNull();
    expect(transport.closed?.code).toBe(CLOSE_CODES.NORMAL);
    expect(client.isClosed).toBe(true);
  });
});
