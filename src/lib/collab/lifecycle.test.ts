import { describe, expect, it, vi } from "vitest";
import {
  connectAsGuest,
  connectAsHost,
  mintRoom,
  type WebSocketFactory,
} from "./lifecycle";
import { CLOSE_CODES, type ServerMessage } from "./protocol";
import type { WebSocketLike } from "./transport";

class FakeWebSocket {
  readonly url: string;
  sent: string[] = [];
  closed: { code?: number; reason?: string } | null = null;
  private listeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(url: string) {
    this.url = url;
  }

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

  fireOpen(): void {
    this.dispatch("open", undefined);
  }
  fireMessage(data: string): void {
    this.dispatch("message", { data });
  }
  fireServer(message: ServerMessage): void {
    this.fireMessage(JSON.stringify(message));
  }
  fireClose(code: number, reason: string): void {
    this.dispatch("close", { code, reason });
  }

  private dispatch(type: string, event: unknown): void {
    for (const cb of this.listeners[type] ?? []) cb(event);
  }
}

function asTransport(fake: FakeWebSocket): WebSocketLike {
  return fake as unknown as WebSocketLike;
}

function captureFactory(): {
  factory: WebSocketFactory;
  sockets: FakeWebSocket[];
} {
  const sockets: FakeWebSocket[] = [];
  return {
    factory: (url) => {
      const ws = new FakeWebSocket(url);
      sockets.push(ws);
      return asTransport(ws);
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

async function flush(turns = 4): Promise<void> {
  for (let i = 0; i < turns; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

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

  it("rewrites ws:// to http:// for the mint request", async () => {
    const fetchFn = mockFetch(SAMPLE_ROOM);
    await mintRoom({ baseUrl: "ws://localhost:4444", fetchFn });
    expect(fetchFn).toHaveBeenCalledWith(
      "http://localhost:4444/rooms",
      expect.anything(),
    );
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
  it("mints a room, opens a WS, awaits welcome, and returns share URLs", async () => {
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
    expect(result.hostToken).toBe("host-token");
    expect(result.shareUrls.edit).toContain(
      `/shared/${SAMPLE_ROOM.roomUuid}?t=edit-tok#k=`,
    );
    expect(result.shareUrls.review).toContain("?t=review-tok#k=");
    expect(result.shareUrls.view).toContain("?t=view-tok#k=");
    expect(result.client.role).toBe("host");
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
    ws.fireClose(CLOSE_CODES.UNAUTHORIZED, "invalid-token");

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
  it("opens a WS with the given token and resolves with the server-confirmed role", async () => {
    const { factory, sockets } = captureFactory();
    // Generate a key and export it so we can pass a valid base64url
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    const raw = await crypto.subtle.exportKey("raw", key);
    const bytes = new Uint8Array(raw);
    let str = "";
    for (let i = 0; i < bytes.length; i++)
      str += String.fromCharCode(bytes[i] as number);
    const keyEncoded = btoa(str)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const promise = connectAsGuest({
      baseUrl: "ws://localhost:4444",
      roomUuid: SAMPLE_ROOM.roomUuid,
      token: "edit-tok",
      keyEncoded,
      wsFactory: factory,
    });

    await flush();
    const ws = sockets[0];
    if (!ws) throw new Error("no socket");
    expect(ws.url).toBe(
      `ws://localhost:4444/room/${SAMPLE_ROOM.roomUuid}?t=edit-tok`,
    );

    ws.fireOpen();
    ws.fireServer({
      type: "welcome",
      peerId: "p-guest",
      role: "edit",
      peerCount: 2,
      hostPresent: true,
    });

    const result = await promise;
    expect(result.role).toBe("edit");
    expect(result.peerId).toBe("p-guest");
    expect(result.hostPresent).toBe(true);
    expect(result.client.role).toBe("edit");
  });

  it("rejects on a malformed key fragment", async () => {
    const { factory } = captureFactory();
    await expect(
      connectAsGuest({
        baseUrl: "ws://localhost:4444",
        roomUuid: SAMPLE_ROOM.roomUuid,
        token: "edit-tok",
        keyEncoded: "not-a-valid-key",
        wsFactory: factory,
      }),
    ).rejects.toBeDefined();
  });
});
