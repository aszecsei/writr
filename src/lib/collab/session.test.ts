import { beforeEach, describe, expect, it, vi } from "vitest";
import { Awareness, encodeAwarenessUpdate } from "y-protocols/awareness";
import * as Y from "yjs";
import { CollabClient, type CollabTransport } from "./client";
import {
  decryptPayload,
  encryptPayload,
  generateRoomKey,
  type RoomKey,
} from "./crypto";
import type { ClientMessage, ServerMessage } from "./protocol";
import { CollabSession } from "./session";

class MockTransport implements CollabTransport {
  sent: ClientMessage[] = [];
  closed: { code?: number; reason?: string } | null = null;

  send(data: string): void {
    this.sent.push(JSON.parse(data) as ClientMessage);
  }
  close(code?: number, reason?: string): void {
    if (!this.closed) {
      this.closed = {};
      if (code !== undefined) this.closed.code = code;
      if (reason !== undefined) this.closed.reason = reason;
    }
  }
}

async function deliver(
  client: CollabClient,
  message: ServerMessage,
): Promise<void> {
  await client.handleMessage(JSON.stringify(message));
}

async function flush(): Promise<void> {
  // crypto.subtle.encrypt resolves on the macrotask queue under Node;
  // a single setTimeout(0) covers both the microtask chain and the I/O turn.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
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

  it("replays buffer updates in order", async () => {
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

    await deliver(client, {
      type: "buffer",
      docKind: "prose",
      streamId: 1,
      updates: [u1, u2, u3],
    });

    expect(session.getDoc("prose").getText("body").toString()).toBe("ABC");
  });

  it("keeps prose and comments docs independent", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const session = new CollabSession({ client });

    const proseDoc = new Y.Doc();
    proseDoc.getText("body").insert(0, "prose");
    const commentsDoc = new Y.Doc();
    commentsDoc.getText("body").insert(0, "comment");

    await deliver(client, {
      type: "y-update",
      docKind: "prose",
      streamId: 1,
      payload: await encryptPayload(key, Y.encodeStateAsUpdate(proseDoc)),
      from: "peer-x",
    });
    await deliver(client, {
      type: "y-update",
      docKind: "comments",
      streamId: 1,
      payload: await encryptPayload(key, Y.encodeStateAsUpdate(commentsDoc)),
      from: "peer-x",
    });

    expect(session.getDoc("prose").getText("body").toString()).toBe("prose");
    expect(session.getDoc("comments").getText("body").toString()).toBe(
      "comment",
    );
  });
});

describe("CollabSession: rotation", () => {
  it("replaces the Y.Doc and emits onDocReplaced", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const session = new CollabSession({ client });

    const before = session.getDoc("prose");
    before.getText("body").insert(0, "old chapter");

    const replaced = vi.fn();
    session.onDocReplaced(replaced);

    await deliver(client, {
      type: "rotate-stream",
      docKind: "prose",
      newStreamId: 2,
    });

    const after = session.getDoc("prose");
    expect(after).not.toBe(before);
    expect(after.getText("body").toString()).toBe("");
    expect(replaced).toHaveBeenCalledWith("prose", after);
  });

  it("only rotates the targeted docKind", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const session = new CollabSession({ client });

    const prose = session.getDoc("prose");
    const comments = session.getDoc("comments");

    await deliver(client, {
      type: "rotate-stream",
      docKind: "prose",
      newStreamId: 2,
    });

    expect(session.getDoc("comments")).toBe(comments);
    expect(session.getDoc("prose")).not.toBe(prose);
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
});
