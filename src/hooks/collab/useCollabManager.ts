"use client";

import { useCallback, useEffect } from "react";
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
  /** When true, share the entire project read-only alongside the active
   *  chapter. Existing edit/review/view roles still apply to the active
   *  chapter; everything else is read-only for every guest. */
  projectMode?: boolean;
}

export interface JoinAsGuestOptions {
  roomUuid: string;
  token: string;
  hostPubEncoded: string;
  signal?: AbortSignal;
  wsFactory?: WebSocketFactory;
  /** Display name + caret color used for this peer. Required for the join-request payload. */
  identity: CollabIdentityInput;
  /** Mirror of the `mode=project` URL fragment flag. The guest's UI
   *  should pre-set this from the URL before calling joinAsGuest so the
   *  shell knows which layout to render before the project meta arrives. */
  projectMode?: boolean;
}

export interface UseCollabManagerOptions {
  /**
   * Only the call site responsible for the session's lifecycle (AppShell
   * for a host, the guest page for a guest) should pass true. That's the
   * only instance whose unmount tears the shared session down; every other
   * instance reads and drives the same session without owning it.
   */
  ownsLifecycle?: boolean;
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
 * The imperative connection state for the collab session, shared across
 * every mounted `useCollabManager()` instance. Only one session can be
 * live in a tab at a time, and the components that observe or drive it
 * (ShareDialog, CollabBanner, ApproveJoinDialog, ManageParticipantsDialog,
 * the guest page) each call the hook independently — so this state can't
 * live in a per-instance ref without call sites other than the one that
 * started the session losing access to it.
 */
interface LiveCollabState {
  session: CollabSession | null;
  client: CollabClient | null;
  joinHandle: JoinRequestHandle | null;
  detach: (() => void) | null;
  roomUuid: string | null;
}

const live: LiveCollabState = {
  session: null,
  client: null,
  joinHandle: null,
  detach: null,
  roomUuid: null,
};

/**
 * Owns the imperative lifecycle of the collab session on behalf of every
 * mounted call site. Composes the lifecycle helpers with the store-event
 * bridge; teardown on unmount is opt-in via `{ ownsLifecycle: true }` (see
 * `UseCollabManagerOptions`) since the session must outlive any single
 * dialog and end only via `end()`, a fatal transport error, or the owning
 * component's unmount.
 *
 * UI components should branch on `enabled` so that no collab affordances
 * render when the feature isn't configured.
 */
export function useCollabManager(
  options?: UseCollabManagerOptions,
): UseCollabManager {
  const ownsLifecycle = options?.ownsLifecycle === true;

  const teardown = useCallback(() => {
    live.joinHandle?.detach();
    live.joinHandle = null;
    live.detach?.();
    live.detach = null;
    live.session?.destroy();
    live.session = null;
    live.client = null;
    clearHostKey(live.roomUuid);
    live.roomUuid = null;
    useCollabStore.getState().reset();
  }, []);

  // Cleanup on unmount, only for the call site that owns the lifecycle.
  useEffect(() => {
    if (!ownsLifecycle) return;
    return teardown;
  }, [ownsLifecycle, teardown]);

  const startAsHost = useCallback<UseCollabManager["startAsHost"]>(
    async (opts) => {
      const baseUrl = getCollabBaseUrl();
      if (!baseUrl) throw new CollabNotEnabledError();
      if (live.session) throw new CollabAlreadyActiveError();

      useCollabStore.getState().setStatus("connecting");
      // Set identity BEFORE the session connects so editors that read from
      // the store on first render see the right name + color.
      if (opts?.identity) {
        useCollabStore.getState().setIdentity(opts.identity);
      }
      // Pre-set projectMode so any host-side effect that mounts on
      // session-creation (e.g. HostProjectMirror) sees the right value.
      useCollabStore.getState().setProjectMode(opts?.projectMode === true);
      const { identity: _hostIdentity, ...connectOpts } = opts ?? {};
      try {
        const conn = await connectAsHost({ baseUrl, ...connectOpts });
        const detach = attachClientToStore(conn.client, useCollabStore);
        live.detach = detach;
        live.session = conn.session;
        live.roomUuid = conn.roomUuid;
        live.client = conn.client;

        // Track peer_left so we know when an approved guest goes offline
        // (and clear their tracked peerId so a stale kick-peer can't fire).
        const offSystemForPeerLeft = conn.client.on("system", (event) => {
          if (event.event === "peer_left") {
            useCollabStore.getState().clearGuestPeerId(event.peerId);
          }
        });
        const previousDetach = live.detach;
        live.detach = () => {
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

        live.joinHandle = attachJoinRequestHandler({
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
      if (live.session) throw new CollabAlreadyActiveError();

      useCollabStore.getState().setIdentity(opts.identity);
      useCollabStore.getState().setStatus("awaiting_approval");
      useCollabStore.getState().setDeniedReason(null);
      // Pre-set projectMode from the URL fragment so the guest shell can
      // render the right layout before the project meta arrives.
      useCollabStore.getState().setProjectMode(opts.projectMode === true);

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
        live.detach = detach;
        live.session = conn.session;

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
    const handle = live.joinHandle;
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
      const handle = live.joinHandle;
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
    if (entry?.peerId && live.client) {
      live.client.sendKickPeer(entry.peerId);
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
