import { describe, expect, it } from "vitest";
import { CollabClient, type CollabTransport } from "./client";
import {
  deriveWrapKey,
  generateRoomKey,
  generateX25519Keypair,
  importX25519PubFromEncoded,
  wrapRoomKey,
} from "./crypto";
import {
  attachJoinRequestHandler,
  HandshakeAbortedError,
  JoinDeniedError,
  runGuestHandshake,
} from "./handshake";
import type { ServerMessage } from "./protocol";
import type { WebSocketLike } from "./transport";

class FakeWebSocket {
  readonly url = "fake://socket";
  sent: string[] = [];
  closed: { code?: number; reason?: string } | null = null;
  private listeners: Record<string, Array<(event: unknown) => void>> = {};

  send(data: string): void {
    this.sent.push(data);
  }
  close(code?: number, reason?: string): void {
    if (this.closed) return;
    const close: { code?: number; reason?: string } = {};
    if (code !== undefined) close.code = code;
    if (reason !== undefined) close.reason = reason;
    this.closed = close;
    this.dispatch("close", { code: code ?? 1000, reason: reason ?? "" });
  }
  addEventListener(type: string, listener: (event: unknown) => void): void {
    const bucket = this.listeners[type] ?? [];
    bucket.push(listener);
    this.listeners[type] = bucket;
  }
  fireServer(message: ServerMessage): void {
    this.dispatch("message", { data: JSON.stringify(message) });
  }
  fireClose(code: number, reason: string): void {
    this.dispatch("close", { code, reason });
  }
  fireError(): void {
    this.dispatch("error", undefined);
  }
  private dispatch(type: string, event: unknown): void {
    for (const cb of this.listeners[type] ?? []) cb(event);
  }
}

function asWs(fake: FakeWebSocket): WebSocketLike {
  return fake as unknown as WebSocketLike;
}

async function flush(turns = 6): Promise<void> {
  for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 0));
}

const ROOM = "11111111-2222-3333-4444-555555555555";

describe("runGuestHandshake", () => {
  it("welcome → join-request → join-approved produces a usable room key", async () => {
    const fake = new FakeWebSocket();
    const hostPair = await generateX25519Keypair();
    const roomKey = await generateRoomKey();

    const promise = runGuestHandshake({
      ws: asWs(fake),
      roomUuid: ROOM,
      hostPubEncoded: hostPair.pubEncoded,
      displayName: "Alice",
      color: "#a1b2c3",
      requestId: "req-1",
    });

    await flush();

    fake.fireServer({
      type: "welcome",
      peerId: "p-guest",
      role: "edit",
      peerCount: 1,
      hostPresent: true,
    });

    await flush();
    expect(fake.sent.length).toBe(1);
    const sent = JSON.parse(fake.sent[0] as string) as {
      type: string;
      requestId: string;
      guestPub: string;
      displayName: string;
      color: string;
    };
    expect(sent.type).toBe("join-request");
    expect(sent.requestId).toBe("req-1");
    expect(sent.displayName).toBe("Alice");
    expect(sent.color).toBe("#a1b2c3");

    const guestPub = await importX25519PubFromEncoded(sent.guestPub);
    const wrapKey = await deriveWrapKey(hostPair.priv, guestPub, ROOM);
    const encryptedRoomKey = await wrapRoomKey(wrapKey, roomKey);

    fake.fireServer({
      type: "join-approved",
      requestId: sent.requestId,
      encryptedRoomKey,
    });

    const result = await promise;
    expect(result.welcome.peerId).toBe("p-guest");
    expect(result.welcome.role).toBe("edit");
    // round-trip: encrypt with the resolved room key, decrypt with the original
    const probe = new TextEncoder().encode("probe");
    const { encryptPayload, decryptPayload } = await import("./crypto");
    const ct = await encryptPayload(result.roomKey, probe);
    const pt = await decryptPayload(roomKey, ct);
    expect(new TextDecoder().decode(pt)).toBe("probe");
  });

  it("rejects with JoinDeniedError when the host denies", async () => {
    const fake = new FakeWebSocket();
    const hostPair = await generateX25519Keypair();

    const promise = runGuestHandshake({
      ws: asWs(fake),
      roomUuid: ROOM,
      hostPubEncoded: hostPair.pubEncoded,
      displayName: "Bob",
      color: "#bbbbbb",
      requestId: "req-1",
    });

    await flush();
    fake.fireServer({
      type: "welcome",
      peerId: "p-guest",
      role: "edit",
      peerCount: 1,
      hostPresent: true,
    });
    await flush();
    fake.fireServer({
      type: "join-denied",
      requestId: "req-1",
      reason: "no",
    });

    await expect(promise).rejects.toBeInstanceOf(JoinDeniedError);
  });

  it("rejects with HandshakeAbortedError when the socket closes pre-completion", async () => {
    const fake = new FakeWebSocket();
    const hostPair = await generateX25519Keypair();

    const promise = runGuestHandshake({
      ws: asWs(fake),
      roomUuid: ROOM,
      hostPubEncoded: hostPair.pubEncoded,
      displayName: "C",
      color: "#cccccc",
    });
    await flush();
    fake.fireClose(4401, "invalid-token");

    await expect(promise).rejects.toBeInstanceOf(HandshakeAbortedError);
  });

  it("buffers non-handshake messages received during the handshake for replay", async () => {
    const fake = new FakeWebSocket();
    const hostPair = await generateX25519Keypair();
    const roomKey = await generateRoomKey();

    const promise = runGuestHandshake({
      ws: asWs(fake),
      roomUuid: ROOM,
      hostPubEncoded: hostPair.pubEncoded,
      displayName: "D",
      color: "#dddddd",
      requestId: "req-1",
    });

    await flush();
    fake.fireServer({
      type: "welcome",
      peerId: "p-guest",
      role: "edit",
      peerCount: 1,
      hostPresent: true,
    });
    await flush();
    const sent = JSON.parse(fake.sent[0] as string) as { guestPub: string };
    const guestPub = await importX25519PubFromEncoded(sent.guestPub);
    const wrapKey = await deriveWrapKey(hostPair.priv, guestPub, ROOM);
    const encryptedRoomKey = await wrapRoomKey(wrapKey, roomKey);

    // server-sent "system" event arrives between welcome and join-approved
    fake.fireServer({
      type: "system",
      data: { event: "host_connected" },
    });
    fake.fireServer({
      type: "join-approved",
      requestId: "req-1",
      encryptedRoomKey,
    });

    const result = await promise;
    expect(result.bufferedMessages.length).toBeGreaterThanOrEqual(1);
    const replayed = result.bufferedMessages.map(
      (raw) => JSON.parse(raw) as { type: string },
    );
    expect(replayed.some((m) => m.type === "system")).toBe(true);
  });
});

describe("attachJoinRequestHandler", () => {
  function makeHostClient(): {
    client: CollabClient;
    sent: string[];
    inject: (msg: ServerMessage) => Promise<void>;
  } {
    const sent: string[] = [];
    const transport: CollabTransport = {
      send: (data) => sent.push(data),
      close: () => {},
    };
    const client = new CollabClient({
      transport,
      key: undefined as unknown as CryptoKey,
      role: "host",
    });
    return {
      client,
      sent,
      inject: (msg) => client.handleMessage(JSON.stringify(msg)),
    };
  }

  it("auto-approves a guest when isApproved returns true (no onIncoming)", async () => {
    const { client, sent } = makeHostClient();
    const hostPair = await generateX25519Keypair();
    const guestPair = await generateX25519Keypair();
    const roomKey = await generateRoomKey();

    let onIncomingCalled = false;
    const handle = attachJoinRequestHandler({
      client,
      hostPriv: hostPair.priv,
      roomKey,
      roomUuid: ROOM,
      isApproved: () => true,
      onIncoming: () => {
        onIncomingCalled = true;
      },
      onCancelled: () => {},
    });

    await client.handleMessage(
      JSON.stringify({
        type: "join-request",
        requestId: "req-1",
        guestPub: guestPair.pubEncoded,
        displayName: "Alice",
        color: "#a1b2c3",
        from: "p-guest",
      }),
    );
    await flush();

    expect(onIncomingCalled).toBe(false);
    const approvedMsg = sent.find((s) => s.includes("join-approved"));
    expect(approvedMsg).toBeDefined();
    handle.detach();
  });

  it("approve(requestId) wraps the room key and sends join-approved", async () => {
    const { client, sent } = makeHostClient();
    const hostPair = await generateX25519Keypair();
    const guestPair = await generateX25519Keypair();
    const roomKey = await generateRoomKey();

    const handle = attachJoinRequestHandler({
      client,
      hostPriv: hostPair.priv,
      roomKey,
      roomUuid: ROOM,
      isApproved: () => false,
      onIncoming: () => {},
      onCancelled: () => {},
    });

    await client.handleMessage(
      JSON.stringify({
        type: "join-request",
        requestId: "req-1",
        guestPub: guestPair.pubEncoded,
        displayName: "Alice",
        color: "#a1b2c3",
        from: "p-guest-1",
      }),
    );

    await handle.approve("req-1");

    const sentMsg = sent.find((s) => s.includes("join-approved"));
    expect(sentMsg).toBeDefined();
    const parsed = JSON.parse(sentMsg as string) as {
      requestId: string;
      to: string;
    };
    expect(parsed.requestId).toBe("req-1");
    expect(parsed.to).toBe("p-guest-1");

    handle.detach();
  });

  it("onCancelled fires on system join_request_cancelled", async () => {
    const { client } = makeHostClient();
    const hostPair = await generateX25519Keypair();
    const roomKey = await generateRoomKey();
    const cancellations: string[] = [];

    const handle = attachJoinRequestHandler({
      client,
      hostPriv: hostPair.priv,
      roomKey,
      roomUuid: ROOM,
      isApproved: () => false,
      onIncoming: () => {},
      onCancelled: (reqId) => cancellations.push(reqId),
    });

    await client.handleMessage(
      JSON.stringify({
        type: "system",
        data: { event: "join_request_cancelled", requestId: "req-1" },
      }),
    );

    expect(cancellations).toEqual(["req-1"]);
    handle.detach();
  });
});
