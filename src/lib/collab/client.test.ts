import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollabClient } from "./client";
import {
  decryptPayload,
  encryptPayload,
  generateRoomKey,
  type RoomKey,
} from "./crypto";
import type { ServerMessage } from "./protocol";
import { MockTransport } from "./test-support";

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

describe("CollabClient: lifecycle", () => {
  it("stores peerId after welcome and emits the event", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const onWelcome = vi.fn();
    client.on("welcome", onWelcome);

    await deliver(client, {
      type: "welcome",
      peerId: "peer-1",
      role: "edit",
      peerCount: 2,
      hostPresent: true,
    });

    expect(client.peerId).toBe("peer-1");
    expect(onWelcome).toHaveBeenCalledWith({
      peerId: "peer-1",
      role: "edit",
      peerCount: 2,
      hostPresent: true,
    });
  });

  it("defaults to 'view' at construction and updates from the server welcome message", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key });
    expect(client.role).toBe("view");
    await deliver(client, {
      type: "welcome",
      peerId: "p",
      role: "edit",
      peerCount: 1,
      hostPresent: false,
    });
    expect(client.role).toBe("edit");
    // After welcome, formerly-blocked outgoing y-update should now be allowed.
    await client.sendYUpdate("prose", new Uint8Array([1]));
    expect(transport.sent.filter((m) => m.type === "y-update")).toHaveLength(1);
  });

  it("emits close and refuses further sends after close", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const onClose = vi.fn();
    client.on("close", onClose);

    client.handleClose(1000, "bye");
    expect(onClose).toHaveBeenCalledWith({ code: 1000, reason: "bye" });
    expect(client.isClosed).toBe(true);

    await client.sendYUpdate("prose", new Uint8Array([1, 2, 3]));
    expect(transport.sent).toHaveLength(0);
  });
});

describe("CollabClient: outgoing encryption", () => {
  it("encrypts y-update and stamps current streamId", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });

    const update = new Uint8Array([10, 20, 30]);
    await client.sendYUpdate("prose", update);

    expect(transport.sent).toHaveLength(1);
    const sent = transport.sent[0];
    expect(sent?.type).toBe("y-update");
    if (sent?.type === "y-update") {
      expect(sent.docKind).toBe("prose");
      expect(sent.streamId).toBe(1);
      const decrypted = await decryptPayload(key, sent.payload);
      expect(Array.from(decrypted)).toEqual([10, 20, 30]);
    }
  });

  it("encrypts awareness payload", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "view" });

    await client.sendAwareness(new Uint8Array([1, 2]));

    const sent = transport.sent[0];
    expect(sent?.type).toBe("awareness");
    if (sent?.type === "awareness") {
      const decrypted = await decryptPayload(key, sent.payload);
      expect(Array.from(decrypted)).toEqual([1, 2]);
    }
  });
});

describe("CollabClient: outgoing role gating", () => {
  it("blocks 'view' from sending y-update locally", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "view" });
    const onError = vi.fn();
    client.on("error", onError);

    await client.sendYUpdate("prose", new Uint8Array([1]));

    expect(transport.sent).toHaveLength(0);
    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0]?.[0]?.kind).toBe("send-not-allowed");
  });

  it("blocks 'review' from sending prose y-update but permits comments", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "review" });

    await client.sendYUpdate("prose", new Uint8Array([1]));
    expect(transport.sent).toHaveLength(0);

    await client.sendYUpdate("comments", new Uint8Array([2]));
    expect(transport.sent).toHaveLength(1);
  });
});

describe("CollabClient: incoming decryption", () => {
  it("decrypts y-update and emits raw bytes", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const onUpdate = vi.fn();
    client.on("y-update", onUpdate);

    const payload = await encryptPayload(key, new Uint8Array([5, 6, 7]));
    await deliver(client, {
      type: "y-update",
      docKind: "prose",
      streamId: 1,
      payload,
      from: "peer-x",
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const event = onUpdate.mock.calls[0]?.[0];
    expect(event?.docKind).toBe("prose");
    expect(event?.from).toBe("peer-x");
    expect(Array.from(event?.update as Uint8Array)).toEqual([5, 6, 7]);
  });

  it("emits decrypt error and does not crash when payload is tampered", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const onError = vi.fn();
    const onUpdate = vi.fn();
    client.on("error", onError);
    client.on("y-update", onUpdate);

    await deliver(client, {
      type: "y-update",
      docKind: "prose",
      streamId: 1,
      payload: "AAAAAAAAAAAAAAAAAAAA",
      from: "peer-x",
    });

    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0]?.[0]?.kind).toBe("decrypt");
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("decrypts buffer messages and updates streamId", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "view" });
    const onBuffer = vi.fn();
    client.on("buffer", onBuffer);

    const a = await encryptPayload(key, new Uint8Array([1]));
    const b = await encryptPayload(key, new Uint8Array([2]));

    await deliver(client, {
      type: "buffer",
      docKind: "prose",
      streamId: 3,
      updates: [a, b],
    });

    expect(onBuffer).toHaveBeenCalledTimes(1);
    const ev = onBuffer.mock.calls[0]?.[0];
    expect(ev?.streamId).toBe(3);
    expect(ev?.updates).toHaveLength(2);
    expect(Array.from(ev?.updates[0] as Uint8Array)).toEqual([1]);
  });

  it("surfaces system events", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const onSystem = vi.fn();
    client.on("system", onSystem);

    await deliver(client, {
      type: "system",
      data: { event: "host_disconnected", deadline: 1234 },
    });
    await deliver(client, {
      type: "system",
      data: { event: "host_connected" },
    });

    expect(onSystem).toHaveBeenCalledTimes(2);
    expect(onSystem.mock.calls[0]?.[0]).toEqual({
      event: "host_disconnected",
      deadline: 1234,
    });
  });

  it("rejects malformed server messages", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const onError = vi.fn();
    client.on("error", onError);

    await client.handleMessage("not json");
    await client.handleMessage(JSON.stringify({ type: "unknown-type" }));

    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError.mock.calls[0]?.[0]?.kind).toBe("invalid-message");
    expect(onError.mock.calls[1]?.[0]?.kind).toBe("invalid-message");
  });
});

describe("CollabClient: listener registry", () => {
  it("supports multiple listeners and unsubscribes one without affecting the other", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const a = vi.fn();
    const b = vi.fn();
    client.on("welcome", a);
    const offB = client.on("welcome", b);
    offB();
    await deliver(client, {
      type: "welcome",
      peerId: "p",
      role: "edit",
      peerCount: 1,
      hostPresent: false,
    });
    expect(a).toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });
});
