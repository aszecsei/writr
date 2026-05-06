// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deriveWrapKey,
  generateRoomKey,
  generateX25519Keypair,
  importX25519PubFromEncoded,
  wrapRoomKey,
} from "@/lib/collab/crypto";
import type { Role, ServerMessage } from "@/lib/collab/protocol";
import { useCollabStore } from "@/store/collabStore";
import { useUiStore } from "@/store/uiStore";
import {
  CollabAlreadyActiveError,
  CollabNotEnabledError,
  useCollabManager,
} from "./useCollabManager";

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_COLLAB_URL;

class FakeWebSocket {
  readonly url: string;
  sent: string[] = [];
  private listeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(url: string) {
    this.url = url;
  }
  send(data: string): void {
    this.sent.push(data);
  }
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

async function flush(turns = 6): Promise<void> {
  for (let i = 0; i < turns; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_COLLAB_URL = "ws://localhost:4444";
  useCollabStore.getState().reset();
  useUiStore.getState().closeModal();
  if (typeof window !== "undefined") window.sessionStorage.clear();
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.NEXT_PUBLIC_COLLAB_URL;
  else process.env.NEXT_PUBLIC_COLLAB_URL = ORIGINAL_ENV;
  useCollabStore.getState().reset();
  useUiStore.getState().closeModal();
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
        hostPubEncoded: "abc",
        identity: { name: "A", color: "#000000" },
      }),
    ).rejects.toBeInstanceOf(CollabNotEnabledError);
  });
});

async function bringUpHost(
  wsFactory: never,
  fetchFn: typeof fetch,
): Promise<{
  result: ReturnType<
    typeof renderHook<ReturnType<typeof useCollabManager>, void>
  >["result"];
  ws: FakeWebSocket;
}> {
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
  const sockets = (wsFactory as unknown as { sockets?: FakeWebSocket[] })
    .sockets;
  void sockets;
  return await flushHost(result, promise);
}

async function flushHost(
  result: { current: ReturnType<typeof useCollabManager> },
  promise: Promise<void>,
): Promise<{ result: typeof result; ws: FakeWebSocket }> {
  // Use the hardcoded singleton via the captured side-effects.
  // We can't easily reach back to sockets here, so callers below should use
  // the explicit pattern instead. This helper exists only to silence TS.
  await promise;
  return { result, ws: undefined as unknown as FakeWebSocket };
}

describe("useCollabManager: startAsHost", () => {
  it("seeds the store with role=host, peerId, peerCount, and shareUrls (#h= form)", async () => {
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
    expect(state.shareUrls?.edit).toContain("?t=edit-tok#h=");
    expect(state.shareUrls?.review).toContain("?t=review-tok#h=");
    expect(state.shareUrls?.view).toContain("?t=view-tok#h=");
    expect(state.shareUrls?.edit).not.toContain("#k=");

    // Host private key should be persisted to sessionStorage for reload.
    const stored = window.sessionStorage.getItem(
      `writr.collab.host.${SAMPLE_ROOM.roomUuid}`,
    );
    expect(stored).not.toBeNull();
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
  it("runs the handshake, sets identity, and seeds the store on approve", async () => {
    const { wsFactory, sockets } = withFakeWs();
    const hostKeypair = await generateX25519Keypair();
    const roomKey = await generateRoomKey();

    const { result } = renderHook(() => useCollabManager());

    let promise!: Promise<void>;
    act(() => {
      promise = result.current.joinAsGuest({
        roomUuid: SAMPLE_ROOM.roomUuid,
        token: "edit-tok",
        hostPubEncoded: hostKeypair.pubEncoded,
        identity: { name: "Alice", color: "#abcdef" },
        wsFactory,
      });
    });

    // After kickoff, status should be awaiting_approval
    await flush(1);
    expect(useCollabStore.getState().status).toBe("awaiting_approval");
    expect(useCollabStore.getState().identity?.name).toBe("Alice");

    await flush();
    const ws = sockets[0];
    if (!ws) throw new Error("no socket");

    ws.fireServer({
      type: "welcome",
      peerId: "p-guest",
      role: "edit",
      peerCount: 2,
      hostPresent: true,
    });

    await flush();
    expect(ws.sent.length).toBeGreaterThanOrEqual(1);
    const sent = JSON.parse(ws.sent[0] as string) as {
      type: string;
      requestId: string;
      guestPub: string;
    };
    expect(sent.type).toBe("join-request");

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

    await act(async () => {
      await promise;
    });

    const state = useCollabStore.getState();
    expect(state.role).toBe("edit");
    expect(state.peerId).toBe("p-guest");
    expect(state.peerCount).toBe(2);
    expect(state.status).toBe("connected");
  });

  it("transitions to status=denied with reason on join-denied", async () => {
    const { wsFactory, sockets } = withFakeWs();
    const hostKeypair = await generateX25519Keypair();

    const { result } = renderHook(() => useCollabManager());

    let promise!: Promise<void>;
    act(() => {
      promise = result.current.joinAsGuest({
        roomUuid: SAMPLE_ROOM.roomUuid,
        token: "edit-tok",
        hostPubEncoded: hostKeypair.pubEncoded,
        identity: { name: "Bob", color: "#112233" },
        wsFactory,
      });
    });

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
    await flush();
    const sent = JSON.parse(ws.sent[0] as string) as { requestId: string };
    ws.fireServer({
      type: "join-denied",
      requestId: sent.requestId,
      reason: "not on the list",
    });

    await act(async () => {
      await promise.catch(() => {});
    });

    const state = useCollabStore.getState();
    expect(state.status).toBe("denied");
    expect(state.deniedReason).toBe("not on the list");
  });
});

describe("useCollabManager: host approval flow", () => {
  async function setUpHost() {
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
      role: "host",
      peerCount: 1,
      hostPresent: true,
    });
    await act(async () => {
      await promise;
    });
    return { result, ws };
  }

  it("opens the approval modal on incoming join-request and approves on approveJoinRequest", async () => {
    const { result, ws } = await setUpHost();
    const guestKeypair = await generateX25519Keypair();

    act(() => {
      ws.fireServer({
        type: "join-request",
        requestId: "req-1",
        guestPub: guestKeypair.pubEncoded,
        displayName: "Carol",
        color: "#ff00ff",
        from: "p-guest-1",
      });
    });
    await flush();

    const ui = useUiStore.getState();
    expect(ui.modal.id).toBe("collab-approve-join");
    expect(useCollabStore.getState().pendingJoinRequests).toHaveLength(1);

    await act(async () => {
      await result.current.approveJoinRequest("req-1");
    });

    expect(useCollabStore.getState().pendingJoinRequests).toHaveLength(0);
    expect(
      useCollabStore.getState().approvedGuests[guestKeypair.pubEncoded],
    ).toBeDefined();
    expect(useUiStore.getState().modal.id).toBeNull();
    // The host should have sent a join-approved message
    const approvedMsg = ws.sent.find((s) => s.includes("join-approved"));
    expect(approvedMsg).toBeDefined();
  });

  it("auto-approves a guest whose pubkey was previously approved (no modal)", async () => {
    const { result, ws } = await setUpHost();
    const guestKeypair = await generateX25519Keypair();

    // First join: shown to user, approved.
    act(() => {
      ws.fireServer({
        type: "join-request",
        requestId: "req-1",
        guestPub: guestKeypair.pubEncoded,
        displayName: "Dave",
        color: "#001122",
        from: "p-guest-1",
      });
    });
    await flush();
    await act(async () => {
      await result.current.approveJoinRequest("req-1");
    });
    expect(
      useCollabStore.getState().approvedGuests[guestKeypair.pubEncoded],
    ).toBeDefined();

    // Second join with the same pubkey: should auto-approve, no modal.
    act(() => {
      ws.fireServer({
        type: "join-request",
        requestId: "req-2",
        guestPub: guestKeypair.pubEncoded,
        displayName: "Dave",
        color: "#001122",
        from: "p-guest-2",
      });
    });
    await flush();
    expect(useUiStore.getState().modal.id).toBeNull();
    // host should still have auto-sent join-approved
    const approvedCount = ws.sent.filter((s) =>
      s.includes("join-approved"),
    ).length;
    expect(approvedCount).toBeGreaterThanOrEqual(2);
  });

  it("denyJoinRequest removes from queue and sends join-denied", async () => {
    const { result, ws } = await setUpHost();
    const guestKeypair = await generateX25519Keypair();
    act(() => {
      ws.fireServer({
        type: "join-request",
        requestId: "req-1",
        guestPub: guestKeypair.pubEncoded,
        displayName: "Eve",
        color: "#abcabc",
        from: "p-guest-1",
      });
    });
    await flush();

    act(() => {
      result.current.denyJoinRequest("req-1", "no thanks");
    });

    expect(useCollabStore.getState().pendingJoinRequests).toHaveLength(0);
    expect(useUiStore.getState().modal.id).toBeNull();
    const deniedMsg = ws.sent.find((s) => s.includes("join-denied"));
    expect(deniedMsg).toBeDefined();
    expect(deniedMsg).toContain("no thanks");
  });

  it("revokeGuest removes from approvedGuests so the next join surfaces the modal", async () => {
    const { result, ws } = await setUpHost();
    const guestKeypair = await generateX25519Keypair();

    act(() => {
      ws.fireServer({
        type: "join-request",
        requestId: "req-1",
        guestPub: guestKeypair.pubEncoded,
        displayName: "Frank",
        color: "#0a0a0a",
        from: "p-guest-1",
      });
    });
    await flush();
    await act(async () => {
      await result.current.approveJoinRequest("req-1");
    });
    expect(
      useCollabStore.getState().approvedGuests[guestKeypair.pubEncoded],
    ).toBeDefined();

    act(() => {
      result.current.revokeGuest(guestKeypair.pubEncoded);
    });
    expect(
      useCollabStore.getState().approvedGuests[guestKeypair.pubEncoded],
    ).toBeUndefined();

    // A subsequent join from same guest now surfaces the modal again.
    act(() => {
      ws.fireServer({
        type: "join-request",
        requestId: "req-2",
        guestPub: guestKeypair.pubEncoded,
        displayName: "Frank",
        color: "#0a0a0a",
        from: "p-guest-2",
      });
    });
    await flush();
    expect(useUiStore.getState().modal.id).toBe("collab-approve-join");
  });

  it("revokeGuest sends kick-peer when the guest is currently connected", async () => {
    const { result, ws } = await setUpHost();
    const guestKeypair = await generateX25519Keypair();

    act(() => {
      ws.fireServer({
        type: "join-request",
        requestId: "req-1",
        guestPub: guestKeypair.pubEncoded,
        displayName: "Grace",
        color: "#aabbcc",
        from: "p-grace",
      });
    });
    await flush();
    await act(async () => {
      await result.current.approveJoinRequest("req-1");
    });

    // Sanity: peerId is tracked.
    expect(
      useCollabStore.getState().approvedGuests[guestKeypair.pubEncoded]?.peerId,
    ).toBe("p-grace");

    ws.sent = [];
    act(() => {
      result.current.revokeGuest(guestKeypair.pubEncoded);
    });

    const kickMsg = ws.sent.find((s) => s.includes("kick-peer"));
    expect(kickMsg).toBeDefined();
    const parsed = JSON.parse(kickMsg as string) as {
      type: string;
      peerId: string;
    };
    expect(parsed).toEqual({ type: "kick-peer", peerId: "p-grace" });
  });

  it("revokeGuest does NOT send kick-peer when the guest is not connected", async () => {
    const { result, ws } = await setUpHost();
    const guestKeypair = await generateX25519Keypair();

    act(() => {
      ws.fireServer({
        type: "join-request",
        requestId: "req-1",
        guestPub: guestKeypair.pubEncoded,
        displayName: "Hank",
        color: "#aabbcc",
        from: "p-hank",
      });
    });
    await flush();
    await act(async () => {
      await result.current.approveJoinRequest("req-1");
    });

    // Simulate guest disconnecting — peer_left clears the tracked peerId.
    act(() => {
      ws.fireServer({
        type: "system",
        data: { event: "peer_left", peerId: "p-hank" },
      });
    });
    expect(
      useCollabStore.getState().approvedGuests[guestKeypair.pubEncoded]?.peerId,
    ).toBeNull();

    ws.sent = [];
    act(() => {
      result.current.revokeGuest(guestKeypair.pubEncoded);
    });

    expect(ws.sent.find((s) => s.includes("kick-peer"))).toBeUndefined();
  });

  it("auto-approve refreshes the tracked peerId in approvedGuests", async () => {
    const { result, ws } = await setUpHost();
    const guestKeypair = await generateX25519Keypair();

    // First approval: peerId p-1.
    act(() => {
      ws.fireServer({
        type: "join-request",
        requestId: "req-1",
        guestPub: guestKeypair.pubEncoded,
        displayName: "Iris",
        color: "#aabbcc",
        from: "p-1",
      });
    });
    await flush();
    await act(async () => {
      await result.current.approveJoinRequest("req-1");
    });
    expect(
      useCollabStore.getState().approvedGuests[guestKeypair.pubEncoded]?.peerId,
    ).toBe("p-1");

    // Guest disconnects, then reconnects with a new peerId. Auto-approve
    // path should update the tracked peerId.
    act(() => {
      ws.fireServer({
        type: "system",
        data: { event: "peer_left", peerId: "p-1" },
      });
      ws.fireServer({
        type: "join-request",
        requestId: "req-2",
        guestPub: guestKeypair.pubEncoded,
        displayName: "Iris",
        color: "#aabbcc",
        from: "p-2",
      });
    });
    await flush();

    expect(
      useCollabStore.getState().approvedGuests[guestKeypair.pubEncoded]?.peerId,
    ).toBe("p-2");
  });

  it("queues subsequent requests; the next one surfaces after approve", async () => {
    const { result, ws } = await setUpHost();
    const a = await generateX25519Keypair();
    const b = await generateX25519Keypair();

    act(() => {
      ws.fireServer({
        type: "join-request",
        requestId: "req-a",
        guestPub: a.pubEncoded,
        displayName: "A",
        color: "#aaaaaa",
        from: "p-a",
      });
      ws.fireServer({
        type: "join-request",
        requestId: "req-b",
        guestPub: b.pubEncoded,
        displayName: "B",
        color: "#bbbbbb",
        from: "p-b",
      });
    });
    await flush();

    const ui = useUiStore.getState();
    expect(ui.modal.id).toBe("collab-approve-join");
    if (ui.modal.id !== "collab-approve-join")
      throw new Error("expected approve-join modal");
    expect(ui.modal.requestId).toBe("req-a");
    expect(useCollabStore.getState().pendingJoinRequests).toHaveLength(2);

    await act(async () => {
      await result.current.approveJoinRequest("req-a");
    });

    const ui2 = useUiStore.getState();
    expect(ui2.modal.id).toBe("collab-approve-join");
    if (ui2.modal.id !== "collab-approve-join")
      throw new Error("expected approve-join modal");
    expect(ui2.modal.requestId).toBe("req-b");
  });
});

describe("useCollabManager: lifecycle", () => {
  it("end() resets the store, clears pending state, and wipes sessionStorage", async () => {
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
    expect(
      window.sessionStorage.getItem(
        `writr.collab.host.${SAMPLE_ROOM.roomUuid}`,
      ),
    ).not.toBeNull();

    act(() => result.current.end());

    expect(useCollabStore.getState().session).toBeNull();
    expect(useCollabStore.getState().status).toBe("idle");
    expect(useCollabStore.getState().pendingJoinRequests).toEqual([]);
    expect(useCollabStore.getState().approvedGuests).toEqual({});
    expect(
      window.sessionStorage.getItem(
        `writr.collab.host.${SAMPLE_ROOM.roomUuid}`,
      ),
    ).toBeNull();
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

// silence TS unused-import warnings for helpers above
void bringUpHost;
