"use client";

import { useCallback, useEffect, useRef } from "react";
import { attachClientToStore } from "@/lib/collab/attach";
import type { CollabClient } from "@/lib/collab/client";
import { getCollabBaseUrl, isCollabEnabled } from "@/lib/collab/config";
import { exportX25519PrivJwk, importX25519PrivJwk } from "@/lib/collab/crypto";
import {
  attachJoinRequestHandler,
  type JoinRequestHandle,
} from "@/lib/collab/handshake";
import {
  connectAsGuest,
  connectAsHost,
  type WebSocketFactory,
} from "@/lib/collab/lifecycle";
import type { CollabSession } from "@/lib/collab/session";
import { useCollabStore } from "@/store/collabStore";
import { isCollabApproveJoinModal, useUiStore } from "@/store/uiStore";

export interface CollabIdentityInput {
  name: string;
  color: string;
}

export interface StartAsHostOptions {
  /** Origin used when generating shareable URLs. Defaults to window.location.origin. */
  appOrigin?: string;
  signal?: AbortSignal;
  /** Test seam — overrides global fetch when present. */
  fetchFn?: typeof fetch;
  /** Test seam — overrides the default WebSocket factory when present. */
  wsFactory?: WebSocketFactory;
  /** Display name + caret color used for this peer. */
  identity?: CollabIdentityInput;
}

export interface JoinAsGuestOptions {
  roomUuid: string;
  token: string;
  hostPubEncoded: string;
  signal?: AbortSignal;
  wsFactory?: WebSocketFactory;
  /** Display name + caret color used for this peer. Required for the join-request payload. */
  identity: CollabIdentityInput;
}

export interface UseCollabManager {
  /** False when NEXT_PUBLIC_COLLAB_URL is unset. UI should treat this as "feature off". */
  enabled: boolean;
  startAsHost: (opts?: StartAsHostOptions) => Promise<void>;
  joinAsGuest: (opts: JoinAsGuestOptions) => Promise<void>;
  /** Host-only: approve a pending guest, wrapping the room key for them. */
  approveJoinRequest: (requestId: string) => Promise<void>;
  /** Host-only: deny a pending guest. */
  denyJoinRequest: (requestId: string, reason?: string) => void;
  /**
   * Host-only: forget a previously-approved guest's pubkey. Their next
   * connection will surface the approval modal again. Does NOT actively
   * disconnect a currently-connected peer.
   */
  revokeGuest: (guestPub: string) => void;
  /** Tears down the active session, if any, and resets the store. Idempotent. */
  end: () => void;
}

export class CollabNotEnabledError extends Error {
  constructor() {
    super("Collab is not enabled (NEXT_PUBLIC_COLLAB_URL is unset)");
    this.name = "CollabNotEnabledError";
  }
}

export class CollabAlreadyActiveError extends Error {
  constructor() {
    super("A collab session is already active; call end() first");
    this.name = "CollabAlreadyActiveError";
  }
}

const HOST_KEY_STORAGE_PREFIX = "writr.collab.host.";

interface StoredHostKey {
  jwk: JsonWebKey;
  pubEncoded: string;
  roomUuid: string;
}

function hostKeyStorageKey(roomUuid: string): string {
  return `${HOST_KEY_STORAGE_PREFIX}${roomUuid}`;
}

async function persistHostKey(
  roomUuid: string,
  priv: CryptoKey,
  pubEncoded: string,
): Promise<void> {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    const jwk = await exportX25519PrivJwk(priv);
    const payload: StoredHostKey = { jwk, pubEncoded, roomUuid };
    window.sessionStorage.setItem(
      hostKeyStorageKey(roomUuid),
      JSON.stringify(payload),
    );
  } catch {
    // sessionStorage can throw in private mode / quota exceeded — non-fatal.
  }
}

function clearHostKey(roomUuid: string | null): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  if (roomUuid) {
    try {
      window.sessionStorage.removeItem(hostKeyStorageKey(roomUuid));
    } catch {
      // ignore
    }
  }
}

/**
 * Owns the imperative lifecycle of a single CollabSession on behalf of a
 * component tree. Composes the lifecycle helpers with the store-event
 * bridge and guarantees teardown on unmount.
 *
 * UI components should branch on `enabled` so that no collab affordances
 * render when the feature isn't configured.
 */
export function useCollabManager(): UseCollabManager {
  const sessionRef = useRef<CollabSession | null>(null);
  const detachRef = useRef<(() => void) | null>(null);
  const joinHandleRef = useRef<JoinRequestHandle | null>(null);
  const roomUuidRef = useRef<string | null>(null);
  const clientRef = useRef<CollabClient | null>(null);

  const teardown = useCallback(() => {
    joinHandleRef.current?.detach();
    joinHandleRef.current = null;
    detachRef.current?.();
    detachRef.current = null;
    sessionRef.current?.destroy();
    sessionRef.current = null;
    clientRef.current = null;
    clearHostKey(roomUuidRef.current);
    roomUuidRef.current = null;
    useCollabStore.getState().reset();
  }, []);

  // Cleanup on unmount.
  useEffect(() => teardown, [teardown]);

  const startAsHost = useCallback<UseCollabManager["startAsHost"]>(
    async (opts) => {
      const baseUrl = getCollabBaseUrl();
      if (!baseUrl) throw new CollabNotEnabledError();
      if (sessionRef.current) throw new CollabAlreadyActiveError();

      useCollabStore.getState().setStatus("connecting");
      // Set identity BEFORE the session connects so editors that read from
      // the store on first render see the right name + color.
      if (opts?.identity) {
        useCollabStore.getState().setIdentity(opts.identity);
      }
      const { identity: _hostIdentity, ...connectOpts } = opts ?? {};
      try {
        const conn = await connectAsHost({ baseUrl, ...connectOpts });
        const detach = attachClientToStore(conn.client, useCollabStore);
        detachRef.current = detach;
        sessionRef.current = conn.session;
        roomUuidRef.current = conn.roomUuid;
        clientRef.current = conn.client;

        // Track peer_left so we know when an approved guest goes offline
        // (and clear their tracked peerId so a stale kick-peer can't fire).
        const offSystemForPeerLeft = conn.client.on("system", (event) => {
          if (event.event === "peer_left") {
            useCollabStore.getState().clearGuestPeerId(event.peerId);
          }
        });
        const previousDetach = detachRef.current;
        detachRef.current = () => {
          offSystemForPeerLeft();
          previousDetach?.();
        };

        await persistHostKey(conn.roomUuid, conn.hostPriv, conn.hostPubEncoded);

        const store = useCollabStore.getState();
        store.setSession(conn.session, {
          role: "host",
          peerId: conn.peerId,
          hostPresent: true,
        });
        store.setShareUrls(conn.shareUrls);
        store.setPeerCount(conn.peerCount);

        joinHandleRef.current = attachJoinRequestHandler({
          client: conn.client,
          hostPriv: conn.hostPriv,
          roomKey: conn.roomKey,
          roomUuid: conn.roomUuid,
          isApproved: (guestPub) =>
            Boolean(useCollabStore.getState().approvedGuests[guestPub]),
          onAutoApproved: (req) => {
            useCollabStore.getState().approveGuestPub(req.guestPub, {
              displayName: req.displayName,
              color: req.color,
              peerId: req.from,
            });
          },
          onIncoming: (req) => {
            const collab = useCollabStore.getState();
            collab.addPendingJoinRequest({
              requestId: req.requestId,
              guestPub: req.guestPub,
              displayName: req.displayName,
              color: req.color,
              from: req.from,
              receivedAt: Date.now(),
            });
            const ui = useUiStore.getState();
            // If no modal is currently open, surface this request. Otherwise
            // it stays in the queue and the next-up logic will pick it up.
            if (ui.modal.id === null) {
              ui.openModal({
                id: "collab-approve-join",
                requestId: req.requestId,
                displayName: req.displayName,
                color: req.color,
              });
            }
          },
          onCancelled: (requestId) => {
            const collab = useCollabStore.getState();
            collab.removePendingJoinRequest(requestId);
            // If the cancelled request was the one currently being shown,
            // close the modal so a stale prompt doesn't linger. Then advance.
            const ui = useUiStore.getState();
            if (
              isCollabApproveJoinModal(ui.modal) &&
              ui.modal.requestId === requestId
            ) {
              ui.closeModal();
              advanceJoinModal();
            }
          },
        });
      } catch (err) {
        const store = useCollabStore.getState();
        store.setStatus("ended");
        if (!store.error) {
          store.setError({
            kind: "transport",
            message: err instanceof Error ? err.message : String(err),
          });
        }
        throw err;
      }
    },
    [],
  );

  const joinAsGuest = useCallback<UseCollabManager["joinAsGuest"]>(
    async (opts) => {
      const baseUrl = getCollabBaseUrl();
      if (!baseUrl) throw new CollabNotEnabledError();
      if (sessionRef.current) throw new CollabAlreadyActiveError();

      useCollabStore.getState().setIdentity(opts.identity);
      useCollabStore.getState().setStatus("awaiting_approval");
      useCollabStore.getState().setDeniedReason(null);

      const connectOpts: Parameters<typeof connectAsGuest>[0] = {
        baseUrl,
        roomUuid: opts.roomUuid,
        token: opts.token,
        hostPubEncoded: opts.hostPubEncoded,
        displayName: opts.identity.name,
        color: opts.identity.color,
      };
      if (opts.signal) connectOpts.signal = opts.signal;
      if (opts.wsFactory) connectOpts.wsFactory = opts.wsFactory;

      try {
        const conn = await connectAsGuest(connectOpts);
        const detach = attachClientToStore(conn.client, useCollabStore);
        detachRef.current = detach;
        sessionRef.current = conn.session;

        const store = useCollabStore.getState();
        store.setSession(conn.session, {
          role: conn.role,
          peerId: conn.peerId,
          hostPresent: conn.hostPresent,
        });
        store.setPeerCount(conn.peerCount);
      } catch (err) {
        const store = useCollabStore.getState();
        // JoinDeniedError is a non-error end-state for the guest UI; surface
        // it as `denied` rather than a transport error.
        const name = err instanceof Error ? err.name : "";
        if (name === "JoinDeniedError") {
          const reason = err instanceof Error ? err.message : null;
          store.setDeniedReason(
            err instanceof Error && "reason" in err
              ? ((err as { reason?: string }).reason ?? reason)
              : reason,
          );
          store.setStatus("denied");
        } else {
          store.setStatus("ended");
          if (!store.error) {
            store.setError({
              kind: "transport",
              message: err instanceof Error ? err.message : String(err),
            });
          }
        }
        throw err;
      }
    },
    [],
  );

  const approveJoinRequest = useCallback<
    UseCollabManager["approveJoinRequest"]
  >(async (requestId) => {
    const handle = joinHandleRef.current;
    if (!handle) return;
    const collab = useCollabStore.getState();
    const req = collab.pendingJoinRequests.find(
      (p) => p.requestId === requestId,
    );
    if (!req) return;
    await handle.approve(requestId);
    collab.approveGuestPub(req.guestPub, {
      displayName: req.displayName,
      color: req.color,
      peerId: req.from,
    });
    collab.removePendingJoinRequest(requestId);
    const ui = useUiStore.getState();
    if (
      isCollabApproveJoinModal(ui.modal) &&
      ui.modal.requestId === requestId
    ) {
      ui.closeModal();
    }
    advanceJoinModal();
  }, []);

  const denyJoinRequest = useCallback<UseCollabManager["denyJoinRequest"]>(
    (requestId, reason) => {
      const handle = joinHandleRef.current;
      if (!handle) return;
      handle.deny(requestId, reason);
      const collab = useCollabStore.getState();
      collab.removePendingJoinRequest(requestId);
      const ui = useUiStore.getState();
      if (
        isCollabApproveJoinModal(ui.modal) &&
        ui.modal.requestId === requestId
      ) {
        ui.closeModal();
      }
      advanceJoinModal();
    },
    [],
  );

  const revokeGuest = useCallback<UseCollabManager["revokeGuest"]>((pub) => {
    const entry = useCollabStore.getState().approvedGuests[pub];
    useCollabStore.getState().revokeGuestPub(pub);
    // If the guest is currently connected, evict them server-side so
    // they actually drop out of the session (not just lose auto-approve).
    if (entry?.peerId && clientRef.current) {
      clientRef.current.sendKickPeer(entry.peerId);
    }
  }, []);

  const end = useCallback(() => teardown(), [teardown]);

  return {
    enabled: isCollabEnabled(),
    startAsHost,
    joinAsGuest,
    approveJoinRequest,
    denyJoinRequest,
    revokeGuest,
    end,
  };
}

/**
 * If there's a pending join-request in the queue and no modal is currently
 * open, surface the next request. Called after approve/deny/cancel to
 * advance the queue.
 */
function advanceJoinModal(): void {
  const ui = useUiStore.getState();
  if (ui.modal.id !== null) return;
  const next = useCollabStore.getState().pendingJoinRequests[0];
  if (!next) return;
  ui.openModal({
    id: "collab-approve-join",
    requestId: next.requestId,
    displayName: next.displayName,
    color: next.color,
  });
}

/**
 * Recover a host's persisted ephemeral keypair after a same-tab reload.
 * Returns null if nothing is stored or if the entry is for a different
 * room. Callers (the host page) can use this to skip re-minting and
 * re-handshaking when the user simply reloaded.
 */
export async function loadPersistedHostKey(
  roomUuid: string,
): Promise<{ priv: CryptoKey; pubEncoded: string } | null> {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  const raw = window.sessionStorage.getItem(hostKeyStorageKey(roomUuid));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredHostKey;
    if (parsed.roomUuid !== roomUuid) return null;
    const priv = await importX25519PrivJwk(parsed.jwk);
    return { priv, pubEncoded: parsed.pubEncoded };
  } catch {
    return null;
  }
}
