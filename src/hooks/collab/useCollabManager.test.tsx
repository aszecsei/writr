// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Role, ServerMessage } from "@/lib/collab/protocol";
import { useCollabStore } from "@/store/collabStore";
import {
  CollabAlreadyActiveError,
  CollabNotEnabledError,
  useCollabManager,
} from "./useCollabManager";

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_COLLAB_URL;

class FakeWebSocket {
  readonly url: string;
  private listeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(url: string) {
    this.url = url;
  }
  send(_data: string): void {}
  close(_code?: number, _reason?: string): void {
    this.dispatch("close", { code: 1000, reason: "" });
  }
  addEventListener(type: string, listener: (event: unknown) => void): void {
    const bucket = this.listeners[type] ?? [];
    bucket.push(listener);
    this.listeners[type] = bucket;
  }
  fireOpen(): void {
    this.dispatch("open", undefined);
  }
  fireServer(message: ServerMessage): void {
    this.dispatch("message", { data: JSON.stringify(message) });
  }
  fireClose(code: number, reason: string): void {
    this.dispatch("close", { code, reason });
  }
  private dispatch(type: string, event: unknown): void {
    for (const cb of this.listeners[type] ?? []) cb(event);
  }
}

const SAMPLE_ROOM = {
  roomUuid: "11111111-2222-3333-4444-555555555555",
  hostToken: "host-token",
  inviteTokens: { edit: "edit-tok", review: "review-tok", view: "view-tok" },
};

function withFakeWs() {
  const sockets: FakeWebSocket[] = [];
  const wsFactory = (url: string) => {
    const ws = new FakeWebSocket(url);
    sockets.push(ws);
    return ws as unknown as ReturnType<typeof Object>;
  };
  return { wsFactory: wsFactory as unknown as never, sockets };
}

function mockFetchOk(body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => body,
  } as Response) as unknown as typeof fetch;
}

function mockFetchErr(status: number): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ error: "x" }),
  } as Response) as unknown as typeof fetch;
}

async function flush(turns = 4): Promise<void> {
  for (let i = 0; i < turns; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_COLLAB_URL = "ws://localhost:4444";
  useCollabStore.getState().reset();
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.NEXT_PUBLIC_COLLAB_URL;
  else process.env.NEXT_PUBLIC_COLLAB_URL = ORIGINAL_ENV;
  useCollabStore.getState().reset();
});

describe("useCollabManager: enablement gate", () => {
  it("reports enabled=false when NEXT_PUBLIC_COLLAB_URL is unset", () => {
    delete process.env.NEXT_PUBLIC_COLLAB_URL;
    const { result } = renderHook(() => useCollabManager());
    expect(result.current.enabled).toBe(false);
  });

  it("reports enabled=true when configured", () => {
    const { result } = renderHook(() => useCollabManager());
    expect(result.current.enabled).toBe(true);
  });

  it("startAsHost throws CollabNotEnabledError when not configured", async () => {
    delete process.env.NEXT_PUBLIC_COLLAB_URL;
    const { result } = renderHook(() => useCollabManager());
    await expect(
      result.current.startAsHost({ appOrigin: "https://app.example" }),
    ).rejects.toBeInstanceOf(CollabNotEnabledError);
  });

  it("joinAsGuest throws CollabNotEnabledError when not configured", async () => {
    delete process.env.NEXT_PUBLIC_COLLAB_URL;
    const { result } = renderHook(() => useCollabManager());
    await expect(
      result.current.joinAsGuest({
        roomUuid: "r",
        token: "t",
        keyEncoded: "abc",
      }),
    ).rejects.toBeInstanceOf(CollabNotEnabledError);
  });
});

describe("useCollabManager: startAsHost", () => {
  it("seeds the store with role=host, peerId, peerCount, and shareUrls", async () => {
    const { wsFactory, sockets } = withFakeWs();
    const fetchFn = mockFetchOk(SAMPLE_ROOM);

    const { result } = renderHook(() => useCollabManager());

    let promise!: Promise<void>;
    act(() => {
      promise = result.current.startAsHost({
        appOrigin: "https://app.example",
        fetchFn,
        wsFactory,
      });
    });

    await flush();
    const ws = sockets[0];
    expect(ws).toBeDefined();
    if (!ws) throw new Error("no socket");

    ws.fireOpen();
    ws.fireServer({
      type: "welcome",
      peerId: "p-host",
      role: "host",
      peerCount: 1,
      hostPresent: true,
    });

    await act(async () => {
      await promise;
    });

    const state = useCollabStore.getState();
    expect(state.session).not.toBeNull();
    expect(state.role).toBe("host");
    expect(state.peerId).toBe("p-host");
    expect(state.peerCount).toBe(1);
    expect(state.hostPresent).toBe(true);
    expect(state.status).toBe("connected");
    expect(state.shareUrls?.edit).toContain("?t=edit-tok#k=");
    expect(state.shareUrls?.review).toContain("?t=review-tok#k=");
    expect(state.shareUrls?.view).toContain("?t=view-tok#k=");
  });

  it("records error and sets status=ended when mintRoom fails", async () => {
    const { wsFactory } = withFakeWs();
    const fetchFn = mockFetchErr(429);

    const { result } = renderHook(() => useCollabManager());

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.startAsHost({
          appOrigin: "https://app.example",
          fetchFn,
          wsFactory,
        });
      } catch (err) {
        caught = err;
      }
    });
    expect(caught).toBeDefined();

    const state = useCollabStore.getState();
    expect(state.status).toBe("ended");
    expect(state.error?.kind).toBe("transport");
    expect(state.session).toBeNull();
  });

  it("rejects with CollabAlreadyActiveError if a session is in flight", async () => {
    const { wsFactory, sockets } = withFakeWs();
    const fetchFn = mockFetchOk(SAMPLE_ROOM);

    const { result } = renderHook(() => useCollabManager());

    let p1!: Promise<void>;
    act(() => {
      p1 = result.current.startAsHost({
        appOrigin: "https://app.example",
        fetchFn,
        wsFactory,
      });
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
    await act(async () => {
      await p1;
    });

    await expect(
      result.current.startAsHost({
        appOrigin: "https://app.example",
        fetchFn,
        wsFactory,
      }),
    ).rejects.toBeInstanceOf(CollabAlreadyActiveError);
  });
});

describe("useCollabManager: joinAsGuest", () => {
  it("seeds the store with the server-confirmed role, peerId, peerCount", async () => {
    const { wsFactory, sockets } = withFakeWs();
    // Generate a valid encoded key
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
    let str = "";
    for (let i = 0; i < raw.length; i++)
      str += String.fromCharCode(raw[i] as number);
    const keyEncoded = btoa(str)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const { result } = renderHook(() => useCollabManager());

    let promise!: Promise<void>;
    act(() => {
      promise = result.current.joinAsGuest({
        roomUuid: SAMPLE_ROOM.roomUuid,
        token: "edit-tok",
        keyEncoded,
        wsFactory,
      });
    });

    await flush();
    const ws = sockets[0];
    if (!ws) throw new Error("no socket");

    ws.fireOpen();
    ws.fireServer({
      type: "welcome",
      peerId: "p-guest",
      role: "edit",
      peerCount: 2,
      hostPresent: true,
    });

    await act(async () => {
      await promise;
    });

    const state = useCollabStore.getState();
    expect(state.role).toBe("edit");
    expect(state.peerId).toBe("p-guest");
    expect(state.peerCount).toBe(2);
    expect(state.hostPresent).toBe(true);
    expect(state.status).toBe("connected");
  });
});

describe("useCollabManager: lifecycle", () => {
  it("end() resets the store and clears the session", async () => {
    const { wsFactory, sockets } = withFakeWs();
    const fetchFn = mockFetchOk(SAMPLE_ROOM);

    const { result } = renderHook(() => useCollabManager());

    let promise!: Promise<void>;
    act(() => {
      promise = result.current.startAsHost({
        appOrigin: "https://app.example",
        fetchFn,
        wsFactory,
      });
    });
    await flush();
    const ws = sockets[0];
    if (!ws) throw new Error("no socket");
    ws.fireOpen();
    ws.fireServer({
      type: "welcome",
      peerId: "p-host",
      role: "host" as Role,
      peerCount: 1,
      hostPresent: true,
    });
    await act(async () => {
      await promise;
    });

    expect(useCollabStore.getState().session).not.toBeNull();

    act(() => result.current.end());

    expect(useCollabStore.getState().session).toBeNull();
    expect(useCollabStore.getState().status).toBe("idle");
  });

  it("unmount tears down the session", async () => {
    const { wsFactory, sockets } = withFakeWs();
    const fetchFn = mockFetchOk(SAMPLE_ROOM);

    const { result, unmount } = renderHook(() => useCollabManager());

    let promise!: Promise<void>;
    act(() => {
      promise = result.current.startAsHost({
        appOrigin: "https://app.example",
        fetchFn,
        wsFactory,
      });
    });
    await flush();
    const ws = sockets[0];
    if (!ws) throw new Error("no socket");
    ws.fireOpen();
    ws.fireServer({
      type: "welcome",
      peerId: "p-host",
      role: "host" as Role,
      peerCount: 1,
      hostPresent: true,
    });
    await act(async () => {
      await promise;
    });

    expect(useCollabStore.getState().session).not.toBeNull();

    unmount();

    expect(useCollabStore.getState().session).toBeNull();
    expect(useCollabStore.getState().status).toBe("idle");
  });

  it("end() is idempotent when no session is active", () => {
    const { result } = renderHook(() => useCollabManager());
    expect(() => result.current.end()).not.toThrow();
    expect(useCollabStore.getState().status).toBe("idle");
  });
});
