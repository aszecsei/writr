import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollabClient, type CollabTransport } from "./client";
import {
  decryptPayload,
  encryptPayload,
  generateRoomKey,
  type RoomKey,
} from "./crypto";
import type { ClientMessage, ServerMessage } from "./protocol";

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
  reset() {
    this.sent = [];
    this.closed = null;
  }
}

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

  it("defaults to 'view' role when none is provided at construction", () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key });
    expect(client.role).toBe("view");
  });

  it("updates role from the server welcome message", async () => {
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

  it("uses the latest streamId after rotate-stream from server", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });

    await deliver(client, {
      type: "rotate-stream",
      docKind: "prose",
      newStreamId: 7,
    });

    await client.sendYUpdate("prose", new Uint8Array([1]));
    const sent = transport.sent[0];
    if (sent?.type === "y-update") {
      expect(sent.streamId).toBe(7);
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

  it("blocks non-host from rotateStream and sendMeta", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });

    client.rotateStream("prose", 2);
    expect(
      transport.sent.filter((m) => m.type === "rotate-stream"),
    ).toHaveLength(0);

    await client.sendMeta(1, new Uint8Array([1]));
    expect(transport.sent.filter((m) => m.type === "meta")).toHaveLength(0);
  });

  it("permits host to rotateStream and sendMeta", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "host" });

    client.rotateStream("prose", 5);
    const rotated = transport.sent.find((m) => m.type === "rotate-stream");
    expect(rotated).toBeDefined();

    await client.sendMeta(5, new Uint8Array([42]));
    const meta = transport.sent.find((m) => m.type === "meta");
    expect(meta?.type).toBe("meta");
    if (meta?.type === "meta") {
      const decrypted = await decryptPayload(key, meta.payload);
      expect(Array.from(decrypted)).toEqual([42]);
    }
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

    expect(client.streamIdFor("prose")).toBe(3);
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

describe("CollabClient: rotate-stream propagation", () => {
  it("updates internal streamId when host rotates", () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "host" });

    expect(client.streamIdFor("prose")).toBe(1);
    client.rotateStream("prose", 4);
    expect(client.streamIdFor("prose")).toBe(4);
  });

  it("emits rotate-stream when received from server", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const onRotate = vi.fn();
    client.on("rotate-stream", onRotate);

    await deliver(client, {
      type: "rotate-stream",
      docKind: "comments",
      newStreamId: 9,
    });

    expect(onRotate).toHaveBeenCalledWith({
      docKind: "comments",
      newStreamId: 9,
    });
    expect(client.streamIdFor("comments")).toBe(9);
  });
});

describe("CollabClient: listener registry", () => {
  it("returns an unsubscribe function", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const cb = vi.fn();
    const off = client.on("welcome", cb);
    off();
    await deliver(client, {
      type: "welcome",
      peerId: "p",
      role: "edit",
      peerCount: 1,
      hostPresent: false,
    });
    expect(cb).not.toHaveBeenCalled();
  });

  it("supports multiple listeners for the same event", async () => {
    const transport = new MockTransport();
    const client = new CollabClient({ transport, key, role: "edit" });
    const a = vi.fn();
    const b = vi.fn();
    client.on("welcome", a);
    client.on("welcome", b);
    await deliver(client, {
      type: "welcome",
      peerId: "p",
      role: "edit",
      peerCount: 1,
      hostPresent: false,
    });
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });
});
