import { match, P } from "ts-pattern";
import type { CollabClient } from "./client";
import {
  deriveWrapKey,
  generateX25519Keypair,
  importX25519PubFromEncoded,
  type RoomKey,
  unwrapRoomKey,
  wrapRoomKey,
} from "./crypto";
import { type Role, serverMessageSchema } from "./protocol";
import type { WebSocketLike } from "./transport";

const FATAL_HANDSHAKE_ERROR_CODES = [
  "join-rejected",
  "join-timeout",
  "unauthorized",
  "invalid-token",
  "room-not-found",
  "room-full",
] as const;

export class JoinDeniedError extends Error {
  readonly reason: string | undefined;
  constructor(reason?: string) {
    super(reason ? `Host declined: ${reason}` : "Host declined the request");
    this.name = "JoinDeniedError";
    this.reason = reason;
  }
}

export class HandshakeAbortedError extends Error {
  constructor(message = "Handshake aborted") {
    super(message);
    this.name = "HandshakeAbortedError";
  }
}

interface GuestWelcome {
  peerId: string;
  role: Role;
  peerCount: number;
  hostPresent: boolean;
}

interface RunGuestHandshakeOptions {
  ws: WebSocketLike;
  roomUuid: string;
  hostPubEncoded: string;
  displayName: string;
  color: string;
  signal?: AbortSignal;
}

interface GuestHandshakeResult {
  roomKey: RoomKey;
  welcome: GuestWelcome;
  /**
   * Raw JSON messages received during the handshake that aren't part of it.
   * The caller should `client.handleMessage(...)` each one in order after
   * constructing the post-handshake CollabClient.
   */
  bufferedMessages: string[];
}

/**
 * Run the X25519 / ECDH key-exchange handshake on the guest side over a
 * freshly-opened WebSocket. Adds its own listeners to `ws`, waits for
 * `welcome`, sends `join-request`, and resolves on `join-approved`
 * (decrypting the wrapped room key) or rejects on `join-denied` /
 * close / abort. On resolve, the listeners are detached synchronously
 * so the caller can immediately wire a real `CollabClient`.
 */
export function runGuestHandshake(
  opts: RunGuestHandshakeOptions,
): Promise<GuestHandshakeResult> {
  return new Promise<GuestHandshakeResult>((resolve, reject) => {
    const ws = opts.ws;
    const buffered: string[] = [];
    let welcome: GuestWelcome | null = null;
    let settled = false;
    let detached = false;

    const requestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `req-${Math.random().toString(36).slice(2)}`;

    const onMessage = async (event: { data: string | ArrayBuffer | Blob }) => {
      if (settled) return;
      const raw =
        typeof event.data === "string"
          ? event.data
          : event.data instanceof ArrayBuffer
            ? new TextDecoder().decode(event.data)
            : "";
      if (!raw) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        buffered.push(raw);
        return;
      }
      const result = serverMessageSchema.safeParse(parsed);
      if (!result.success) {
        buffered.push(raw);
        return;
      }
      const msg = result.data;

      await match(msg)
        .with({ type: "welcome" }, async (m) => {
          if (welcome) {
            buffered.push(raw);
            return;
          }
          welcome = {
            peerId: m.peerId,
            role: m.role,
            peerCount: m.peerCount,
            hostPresent: m.hostPresent,
          };
          try {
            ws.send(
              JSON.stringify({
                type: "join-request",
                requestId,
                guestPub: guestKeypair.pubEncoded,
                displayName: opts.displayName,
                color: opts.color,
              }),
            );
          } catch (err) {
            settle();
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        })
        .with({ type: "join-approved" }, async (m) => {
          if (m.requestId !== requestId) {
            buffered.push(raw);
            return;
          }
          try {
            const roomKey = await unwrapRoomKey(wrapKey, m.encryptedRoomKey);
            if (!welcome) {
              settle();
              reject(new Error("join-approved arrived before welcome"));
              return;
            }
            settle();
            resolve({ roomKey, welcome, bufferedMessages: buffered.slice() });
          } catch (err) {
            settle();
            reject(
              new Error(
                `Failed to unwrap room key: ${err instanceof Error ? err.message : String(err)}`,
              ),
            );
          }
        })
        .with({ type: "join-denied" }, async (m) => {
          if (m.requestId !== requestId) {
            buffered.push(raw);
            return;
          }
          settle();
          reject(new JoinDeniedError(m.reason));
        })
        .with(
          { type: "error", code: P.union(...FATAL_HANDSHAKE_ERROR_CODES) },
          async (m) => {
            settle();
            reject(new Error(`Collab handshake failed: ${m.code}`));
          },
        )
        .otherwise(async () => {
          buffered.push(raw);
        });
    };

    const onClose = (event: { code: number; reason: string }) => {
      if (settled) return;
      settle();
      reject(
        new HandshakeAbortedError(
          `WebSocket closed before handshake completed (${event.code}${event.reason ? `: ${event.reason}` : ""})`,
        ),
      );
    };

    const onError = () => {
      if (settled) return;
      settle();
      reject(new HandshakeAbortedError("WebSocket transport error"));
    };

    function settle() {
      settled = true;
      detach();
    }

    function detach() {
      if (detached) return;
      detached = true;
      // We can't actually `removeEventListener` because WebSocketLike
      // doesn't expose it. The settled flag above guards against late
      // dispatches; the caller will wire the real CollabClient and any
      // further messages will be processed by it (see lifecycle).
      if (opts.signal) opts.signal.removeEventListener("abort", onAbort);
    }

    const onAbort = () => {
      if (settled) return;
      settle();
      try {
        ws.close(1000, "aborted");
      } catch {
        // ignore
      }
      reject(new HandshakeAbortedError());
    };

    let guestKeypair!: Awaited<ReturnType<typeof generateX25519Keypair>>;
    let wrapKey!: CryptoKey;

    (async () => {
      try {
        guestKeypair = await generateX25519Keypair();
        const hostPub = await importX25519PubFromEncoded(opts.hostPubEncoded);
        wrapKey = await deriveWrapKey(
          guestKeypair.priv,
          hostPub,
          opts.roomUuid,
        );
      } catch (err) {
        if (settled) return;
        settle();
        reject(
          new Error(
            `Failed to prepare guest handshake keys: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        return;
      }

      ws.addEventListener("message", onMessage);
      ws.addEventListener("close", onClose);
      ws.addEventListener("error", onError);

      if (opts.signal) {
        if (opts.signal.aborted) {
          onAbort();
          return;
        }
        opts.signal.addEventListener("abort", onAbort);
      }
    })();
  });
}

interface AttachJoinRequestHandlerOptions {
  client: CollabClient;
  hostPriv: CryptoKey;
  roomKey: RoomKey;
  roomUuid: string;
  /**
   * Returns true if a guest with this pubkey was previously approved in
   * this session and should be auto-approved (skipping the host UI).
   */
  isApproved: (guestPubEncoded: string) => boolean;
  /**
   * Called for each new (not-yet-approved) join-request the host should
   * surface to the user.
   */
  onIncoming: (req: {
    requestId: string;
    guestPub: string;
    displayName: string;
    color: string;
    from: string;
  }) => void;
  /**
   * Called when the server reports that a pending guest disconnected
   * before the host responded.
   */
  onCancelled: (requestId: string) => void;
  /**
   * Called after a join-request is auto-approved (because `isApproved`
   * returned true for the guest's pubkey). The host UI is bypassed in
   * this path, so the manager uses this hook to update its store.
   */
  onAutoApproved?: (req: {
    requestId: string;
    guestPub: string;
    displayName: string;
    color: string;
    from: string;
  }) => void;
}

export interface JoinRequestHandle {
  approve: (requestId: string) => Promise<void>;
  deny: (requestId: string, reason?: string) => void;
  detach: () => void;
}

interface PendingEntry {
  guestPub: string;
  from: string;
  displayName: string;
  color: string;
}

/**
 * Subscribe a host's CollabClient to incoming join-request and
 * join-request-cancelled events, and expose imperative `approve` /
 * `deny` methods that wrap the room key under the ECDH-derived secret
 * for that specific guest.
 */
export function attachJoinRequestHandler(
  opts: AttachJoinRequestHandlerOptions,
): JoinRequestHandle {
  const pending = new Map<string, PendingEntry>();

  const approve = async (requestId: string) => {
    const entry = pending.get(requestId);
    if (!entry) return;
    pending.delete(requestId);
    const peerPub = await importX25519PubFromEncoded(entry.guestPub);
    const wrapKey = await deriveWrapKey(opts.hostPriv, peerPub, opts.roomUuid);
    const encryptedRoomKey = await wrapRoomKey(wrapKey, opts.roomKey);
    opts.client.sendJoinApproved({
      requestId,
      encryptedRoomKey,
      to: entry.from,
    });
  };

  const deny = (requestId: string, reason?: string) => {
    const entry = pending.get(requestId);
    if (!entry) return;
    pending.delete(requestId);
    opts.client.sendJoinDenied({
      requestId,
      reason,
      to: entry.from,
    });
  };

  const offRequest = opts.client.on("join-request", (req) => {
    pending.set(req.requestId, {
      guestPub: req.guestPub,
      from: req.from,
      displayName: req.displayName,
      color: req.color,
    });
    if (opts.isApproved(req.guestPub)) {
      void approve(req.requestId).then(() => {
        opts.onAutoApproved?.(req);
      });
      return;
    }
    opts.onIncoming(req);
  });

  const offSystem = opts.client.on("system", (event) => {
    if (event.event === "join_request_cancelled") {
      pending.delete(event.requestId);
      opts.onCancelled(event.requestId);
    }
  });

  return {
    approve,
    deny,
    detach: () => {
      offRequest();
      offSystem();
      pending.clear();
    },
  };
}
