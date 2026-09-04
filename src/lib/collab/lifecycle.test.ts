import { describe, expect, it, vi } from "vitest";
import {
  deriveWrapKey,
  generateX25519Keypair,
  importX25519PubFromEncoded,
  wrapRoomKey,
} from "./crypto";
import {
  connectAsGuest,
  connectAsHost,
  mintRoom,
  type WebSocketFactory,
} from "./lifecycle";
import { CLOSE_CODES } from "./protocol";
import { asWebSocketLike, FakeWebSocket, flush } from "./test-support";

function captureFactory(): {
  factory: WebSocketFactory;
  sockets: FakeWebSocket[];
} {
  const sockets: FakeWebSocket[] = [];
  return {
    factory: (url) => {
      const ws = new FakeWebSocket(url);
      sockets.push(ws);
      return asWebSocketLike(ws);
    },
    sockets,
  };
}

function mockFetch(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
): typeof fetch {
  const ok = init.ok ?? true;
  const status = init.status ?? (ok ? 201 : 500);
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as Response) as unknown as typeof fetch;
}

const SAMPLE_ROOM = {
  roomUuid: "11111111-2222-3333-4444-555555555555",
  hostToken: "host-token",
  inviteTokens: { edit: "edit-tok", review: "review-tok", view: "view-tok" },
};

describe("mintRoom", () => {
  it("posts to /rooms on the http origin and returns the body", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => SAMPLE_ROOM,
    } as Response) as unknown as typeof fetch;

    const room = await mintRoom({
      baseUrl: "wss://collab.example.com",
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "https://collab.example.com/rooms",
      expect.objectContaining({ method: "POST" }),
    );
    expect(room).toEqual(SAMPLE_ROOM);
  });

  it("throws a descriptive error on rate limit", async () => {
    const fetchFn = mockFetch(
      { error: "rate-limited" },
      {
        ok: false,
        status: 429,
      },
    );
    await expect(
      mintRoom({ baseUrl: "ws://localhost:4444", fetchFn }),
    ).rejects.toThrow(/rate limited/i);
  });

  it("throws on non-ok responses", async () => {
    const fetchFn = mockFetch({}, { ok: false, status: 500 });
    await expect(
      mintRoom({ baseUrl: "ws://localhost:4444", fetchFn }),
    ).rejects.toThrow(/500/);
  });

  it("wraps network errors", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;
    await expect(
      mintRoom({ baseUrl: "ws://localhost:4444", fetchFn }),
    ).rejects.toThrow(/Network error.*ECONNREFUSED/);
  });
});

describe("connectAsHost", () => {
  it("mints a room, opens a WS, awaits welcome, and returns share URLs with #h=", async () => {
    const { factory, sockets } = captureFactory();
    const fetchFn = mockFetch(SAMPLE_ROOM);

    const promise = connectAsHost({
      baseUrl: "ws://localhost:4444",
      appOrigin: "https://app.example",
      fetchFn,
      wsFactory: factory,
    });

    await flush();
    expect(sockets).toHaveLength(1);
    const ws = sockets[0];
    expect(ws).toBeDefined();
    if (!ws) throw new Error("no socket");

    expect(ws.url).toBe(
      `ws://localhost:4444/room/${SAMPLE_ROOM.roomUuid}?t=host-token`,
    );

    ws.fireOpen();
    ws.fireServer({
      type: "welcome",
      peerId: "p-host",
      role: "host",
      peerCount: 1,
      hostPresent: true,
    });

    const result = await promise;
    expect(result.roomUuid).toBe(SAMPLE_ROOM.roomUuid);
    expect(result.hostPubEncoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(result.shareUrls.edit).toContain(
      `/shared/${SAMPLE_ROOM.roomUuid}?t=edit-tok#h=`,
    );
    expect(result.shareUrls.review).toContain("?t=review-tok#h=");
    expect(result.shareUrls.view).toContain("?t=view-tok#h=");
    expect(result.shareUrls.edit).not.toContain("#k=");
    expect(result.shareUrls.mode).toBe("chapter");
    expect(result.shareUrls.edit).not.toContain("p=1");
    expect(result.client.role).toBe("host");
  });

  it("flags share URLs with mode=project when projectMode is true", async () => {
    const { factory, sockets } = captureFactory();
    const fetchFn = mockFetch(SAMPLE_ROOM);

    const promise = connectAsHost({
      baseUrl: "ws://localhost:4444",
      appOrigin: "https://app.example",
      fetchFn,
      wsFactory: factory,
      projectMode: true,
    });

    await flush();
    const ws = sockets[0];
    if (!ws) throw new Error("no socket");
    ws.fireOpen();
    ws.fireServer({
      type: "welcome",
      peerId: "p-host",
      role: "host",
      peerCount: 1,
      hostPresent: true,
    });

    const result = await promise;
    expect(result.shareUrls.mode).toBe("project");
    expect(result.shareUrls.edit).toContain("&p=1");
    expect(result.shareUrls.review).toContain("&p=1");
    expect(result.shareUrls.view).toContain("&p=1");
  });

  it("rejects and closes the socket if the connection drops before welcome", async () => {
    const { factory, sockets } = captureFactory();
    const fetchFn = mockFetch(SAMPLE_ROOM);

    const promise = connectAsHost({
      baseUrl: "ws://localhost:4444",
      appOrigin: "https://app.example",
      fetchFn,
      wsFactory: factory,
    });

    await flush();
    const ws = sockets[0];
    if (!ws) throw new Error("no socket");
    ws.fireOpen();
    ws.fireClose(CLOSE_CODES.FORBIDDEN, "invalid-token");

    await expect(promise).rejects.toThrow(/closed before welcome/);
  });

  it("rejects when an AbortSignal fires before welcome", async () => {
    const { factory, sockets } = captureFactory();
    const fetchFn = mockFetch(SAMPLE_ROOM);
    const controller = new AbortController();

    const promise = connectAsHost({
      baseUrl: "ws://localhost:4444",
      appOrigin: "https://app.example",
      fetchFn,
      wsFactory: factory,
      signal: controller.signal,
    });

    await flush();
    expect(sockets).toHaveLength(1);
    controller.abort();

    await expect(promise).rejects.toThrow(/aborted/);
  });

  it("propagates mintRoom failures", async () => {
    const fetchFn = mockFetch({}, { ok: false, status: 429 });
    const { factory, sockets } = captureFactory();

    await expect(
      connectAsHost({
        baseUrl: "ws://localhost:4444",
        appOrigin: "https://app.example",
        fetchFn,
        wsFactory: factory,
      }),
    ).rejects.toThrow(/rate limited/i);
    expect(sockets).toHaveLength(0);
  });
});

describe("connectAsGuest", () => {
  it("runs the handshake and resolves with the server-confirmed role", async () => {
    const { factory, sockets } = captureFactory();

    // The "host" side: a fresh keypair we'll use to wrap the room key.
    const hostKeypair = await generateX25519Keypair();
    const roomKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );

    const promise = connectAsGuest({
      baseUrl: "ws://localhost:4444",
      roomUuid: SAMPLE_ROOM.roomUuid,
      token: "edit-tok",
      hostPubEncoded: hostKeypair.pubEncoded,
      displayName: "Alice",
      color: "#abcdef",
      wsFactory: factory,
    });

    await flush();
    const ws = sockets[0];
    if (!ws) throw new Error("no socket");
    expect(ws.url).toBe(
      `ws://localhost:4444/room/${SAMPLE_ROOM.roomUuid}?t=edit-tok`,
    );

    // Server sends welcome
    ws.fireServer({
      type: "welcome",
      peerId: "p-guest",
      role: "edit",
      peerCount: 2,
      hostPresent: true,
    });

    // Guest should send a join-request in response
    await flush();
    expect(ws.sent.length).toBeGreaterThanOrEqual(1);
    const sent = JSON.parse(ws.sent[0] as string) as {
      type: string;
      guestPub: string;
      displayName: string;
      color: string;
      requestId: string;
    };
    expect(sent.type).toBe("join-request");
    expect(sent.displayName).toBe("Alice");
    expect(sent.color).toBe("#abcdef");
    expect(sent.guestPub).toMatch(/^[A-Za-z0-9_-]+$/);

    // "Host" wraps the room key against the guest's pubkey
    const guestPub = await importX25519PubFromEncoded(sent.guestPub);
    const wrapKey = await deriveWrapKey(
      hostKeypair.priv,
      guestPub,
      SAMPLE_ROOM.roomUuid,
    );
    const encryptedRoomKey = await wrapRoomKey(wrapKey, roomKey);

    ws.fireServer({
      type: "join-approved",
      requestId: sent.requestId,
      encryptedRoomKey,
    });

    const result = await promise;
    expect(result.role).toBe("edit");
    expect(result.peerId).toBe("p-guest");
    expect(result.hostPresent).toBe(true);
    expect(result.client.role).toBe("edit");
  });

  it("closes the socket when the handshake is denied", async () => {
    const { factory, sockets } = captureFactory();
    const hostKeypair = await generateX25519Keypair();

    const promise = connectAsGuest({
      baseUrl: "ws://localhost:4444",
      roomUuid: SAMPLE_ROOM.roomUuid,
      token: "edit-tok",
      hostPubEncoded: hostKeypair.pubEncoded,
      displayName: "Bob",
      color: "#112233",
      wsFactory: factory,
    });

    // Swallow the rejection so it's not unhandled while we drive the WS.
    promise.catch(() => {});

    await flush();
    const ws = sockets[0];
    if (!ws) throw new Error("no socket");
    ws.fireServer({
      type: "welcome",
      peerId: "p-guest",
      role: "edit",
      peerCount: 1,
      hostPresent: true,
    });
    await vi.waitFor(() => {
      expect(ws.sent.length).toBeGreaterThan(0);
    });
    const sent = JSON.parse(ws.sent[0] as string) as { requestId: string };
    ws.fireServer({
      type: "join-denied",
      requestId: sent.requestId,
      reason: "not authorized",
    });

    await expect(promise).rejects.toThrow();
    // connectAsGuest is responsible for closing the transport-level socket
    // on handshake failure — the handshake layer itself never touches it.
    expect(ws.closed).not.toBeNull();
  });

  it("rejects on a malformed host pubkey", async () => {
    const { factory } = captureFactory();
    await expect(
      connectAsGuest({
        baseUrl: "ws://localhost:4444",
        roomUuid: SAMPLE_ROOM.roomUuid,
        token: "edit-tok",
        hostPubEncoded: "not-a-valid-key",
        displayName: "x",
        color: "#000000",
        wsFactory: factory,
      }),
    ).rejects.toThrow();
  });
});
