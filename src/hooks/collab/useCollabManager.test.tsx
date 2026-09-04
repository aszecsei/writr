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
import type { WebSocketFactory } from "@/lib/collab/lifecycle";
import {
  asWebSocketLike,
  FakeWebSocket,
  flush,
  withCollabEnv,
} from "@/lib/collab/test-support";
import { useCollabStore } from "@/store/collabStore";
import { useUiStore } from "@/store/uiStore";
import {
  CollabAlreadyActiveError,
  CollabNotEnabledError,
  type UseCollabManagerOptions,
  useCollabManager,
} from "./useCollabManager";

const SAMPLE_ROOM = {
  roomUuid: "11111111-2222-3333-4444-555555555555",
  hostToken: "host-token",
  inviteTokens: { edit: "edit-tok", review: "review-tok", view: "view-tok" },
};

function withFakeWs(): {
  wsFactory: WebSocketFactory;
  sockets: FakeWebSocket[];
} {
  const sockets: FakeWebSocket[] = [];
  const wsFactory: WebSocketFactory = (url) => {
    const ws = new FakeWebSocket(url);
    sockets.push(ws);
    return asWebSocketLike(ws);
  };
  return { wsFactory, sockets };
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

/**
 * Brings a host session fully online: mints a room, opens the fake socket,
 * and delivers `welcome`. Shared by every test that needs a live host
 * session before exercising its own scenario.
 */
async function setUpHost(options?: UseCollabManagerOptions): Promise<{
  result: ReturnType<
    typeof renderHook<ReturnType<typeof useCollabManager>, unknown>
  >["result"];
  unmount: () => void;
  ws: FakeWebSocket;
}> {
  const { wsFactory, sockets } = withFakeWs();
  const fetchFn = mockFetchOk(SAMPLE_ROOM);

  const { result, unmount } = renderHook(() => useCollabManager(options));

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
  return { result, unmount, ws };
}

withCollabEnv("ws://localhost:4444", () => {
  beforeEach(() => {
    useCollabStore.getState().reset();
    useUiStore.getState().closeModal();
  });

  afterEach(() => {
    // The shared connection state in useCollabManager.ts lives at module
    // scope, not per hook instance, so it survives past a test's own
    // unmount unless something calls end() on it explicitly.
    const { result: cleanupResult } = renderHook(() => useCollabManager());
    act(() => {
      cleanupResult.current.end();
    });
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

  describe("useCollabManager: startAsHost", () => {
    it("seeds the store with role=host, peerId, peerCount, and shareUrls (#h= form)", async () => {
      await setUpHost();

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
    });

    it("records error and sets status=ended when mintRoom fails", async () => {
      const { wsFactory } = withFakeWs();
      const fetchFn = mockFetchErr(429);

      const { result } = renderHook(() => useCollabManager());

      await act(async () => {
        await expect(
          result.current.startAsHost({
            appOrigin: "https://app.example",
            fetchFn,
            wsFactory,
          }),
        ).rejects.toThrow();
      });

      const state = useCollabStore.getState();
      expect(state.status).toBe("ended");
      expect(state.error?.kind).toBe("transport");
      expect(state.session).toBeNull();
    });

    it("rejects with CollabAlreadyActiveError if a session is in flight", async () => {
      const { result } = await setUpHost();

      await expect(
        result.current.startAsHost({ appOrigin: "https://app.example" }),
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
        useCollabStore.getState().approvedGuests[guestKeypair.pubEncoded]
          ?.peerId,
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
        useCollabStore.getState().approvedGuests[guestKeypair.pubEncoded]
          ?.peerId,
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
        useCollabStore.getState().approvedGuests[guestKeypair.pubEncoded]
          ?.peerId,
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
        useCollabStore.getState().approvedGuests[guestKeypair.pubEncoded]
          ?.peerId,
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
    it("end() resets the store and clears pending state", async () => {
      const { result } = await setUpHost();

      expect(useCollabStore.getState().session).not.toBeNull();

      act(() => result.current.end());

      expect(useCollabStore.getState().session).toBeNull();
      expect(useCollabStore.getState().status).toBe("idle");
      expect(useCollabStore.getState().pendingJoinRequests).toEqual([]);
      expect(useCollabStore.getState().approvedGuests).toEqual({});
    });

    it("unmount of the owning instance tears down the session", async () => {
      const { unmount } = await setUpHost({ ownsLifecycle: true });

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

    it("end() called from a second hook instance closes the shared socket and resets the store", async () => {
      const { ws } = await setUpHost();
      expect(useCollabStore.getState().session).not.toBeNull();

      const closeSpy = vi.spyOn(ws, "close");
      const { result: otherResult } = renderHook(() => useCollabManager());

      act(() => otherResult.current.end());

      expect(closeSpy).toHaveBeenCalled();
      expect(useCollabStore.getState().session).toBeNull();
      expect(useCollabStore.getState().status).toBe("idle");
    });

    it("approveJoinRequest called from a second hook instance sends the approval on the shared socket", async () => {
      const guestKeypair = await generateX25519Keypair();
      const { ws } = await setUpHost();

      act(() => {
        ws.fireServer({
          type: "join-request",
          requestId: "req-shared-1",
          guestPub: guestKeypair.pubEncoded,
          displayName: "Shared",
          color: "#123456",
          from: "p-guest-shared",
        });
      });
      await flush();
      expect(useCollabStore.getState().pendingJoinRequests).toHaveLength(1);

      const { result: otherResult } = renderHook(() => useCollabManager());

      await act(async () => {
        await otherResult.current.approveJoinRequest("req-shared-1");
      });

      expect(useCollabStore.getState().pendingJoinRequests).toHaveLength(0);
      expect(
        useCollabStore.getState().approvedGuests[guestKeypair.pubEncoded],
      ).toBeDefined();
      const approvedMsg = ws.sent.find((s) => s.includes("join-approved"));
      expect(approvedMsg).toBeDefined();
    });

    it("unmounting a non-owning instance does NOT close the shared socket", async () => {
      const { ws } = await setUpHost();
      expect(useCollabStore.getState().session).not.toBeNull();

      const closeSpy = vi.spyOn(ws, "close");
      const { unmount: unmountOther } = renderHook(() => useCollabManager());

      unmountOther();

      expect(closeSpy).not.toHaveBeenCalled();
      expect(useCollabStore.getState().session).not.toBeNull();
      expect(useCollabStore.getState().status).toBe("connected");
    });
  });
});
