"use client";

import { useCallback, useEffect, useRef } from "react";
import { attachClientToStore } from "@/lib/collab/attach";
import { getCollabBaseUrl, isCollabEnabled } from "@/lib/collab/config";
import {
  connectAsGuest,
  connectAsHost,
  type WebSocketFactory,
} from "@/lib/collab/lifecycle";
import type { CollabSession } from "@/lib/collab/session";
import { useCollabStore } from "@/store/collabStore";

export interface StartAsHostOptions {
  /** Origin used when generating shareable URLs. Defaults to window.location.origin. */
  appOrigin?: string;
  signal?: AbortSignal;
  /** Test seam — overrides global fetch when present. */
  fetchFn?: typeof fetch;
  /** Test seam — overrides the default WebSocket factory when present. */
  wsFactory?: WebSocketFactory;
}

export interface JoinAsGuestOptions {
  roomUuid: string;
  token: string;
  keyEncoded: string;
  signal?: AbortSignal;
  wsFactory?: WebSocketFactory;
}

export interface UseCollabManager {
  /** False when NEXT_PUBLIC_COLLAB_URL is unset. UI should treat this as "feature off". */
  enabled: boolean;
  startAsHost: (opts?: StartAsHostOptions) => Promise<void>;
  joinAsGuest: (opts: JoinAsGuestOptions) => Promise<void>;
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

  const teardown = useCallback(() => {
    detachRef.current?.();
    detachRef.current = null;
    sessionRef.current?.destroy();
    sessionRef.current = null;
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
      try {
        const conn = await connectAsHost({ baseUrl, ...opts });
        const detach = attachClientToStore(conn.client, useCollabStore);
        detachRef.current = detach;
        sessionRef.current = conn.session;

        const store = useCollabStore.getState();
        store.setSession(conn.session, {
          role: "host",
          peerId: conn.peerId,
          hostPresent: true,
        });
        store.setShareUrls(conn.shareUrls);
        store.setPeerCount(conn.peerCount);
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

      useCollabStore.getState().setStatus("connecting");
      try {
        const conn = await connectAsGuest({ baseUrl, ...opts });
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

  const end = useCallback(() => teardown(), [teardown]);

  return {
    enabled: isCollabEnabled(),
    startAsHost,
    joinAsGuest,
    end,
  };
}
