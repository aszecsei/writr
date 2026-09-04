import { randomBytes } from "node:crypto";
import { match } from "ts-pattern";
import {
  CLOSE_CODES,
  type ClientMessage,
  canSend,
  clientMessageSchema,
  DOC_KINDS,
  type DocKind,
  type ErrorCode,
  type Role,
  type ServerMessage,
  type SystemEvent,
} from "./protocol.js";
import { findTokenRole, tokensEqual } from "./tokens.js";

export interface SocketLike {
  send(data: string): void;
  close(code: number, reason?: string): void;
}

export interface RoomOptions {
  uuid: string;
  hostToken: string;
  inviteTokens: ReadonlyMap<string, Exclude<Role, "host">>;
  gracePeriodMs?: number;
  idleTimeoutMs?: number;
  maxSockets?: number;
  maxBufferBytes?: number;
  /**
   * How long a non-host peer can remain in the join-request limbo before
   * the server times them out and closes the socket. Defaults to 120s.
   */
  joinTimeoutMs?: number;
  onDestroy?: (uuid: string) => void;
  now?: () => number;
}

interface Stream {
  currentStreamId: number;
  buffer: string[];
  bufferBytes: number;
}

interface AttachedSocket {
  socket: SocketLike;
  role: Role;
  peerId: string;
}

interface PendingState {
  /** The requestId the guest sent on `join-request`, once they've sent it. */
  requestId: string | null;
  /** Timer that fires `join-timeout` if the host hasn't decided in time. */
  timeoutTimer: ReturnType<typeof setTimeout> | null;
}

const PEER_ID_BYTES = 8;
const DEFAULT_GRACE_MS = 60_000;
const DEFAULT_IDLE_MS = 30 * 60_000;
const DEFAULT_MAX_SOCKETS = 16;
const DEFAULT_MAX_BUFFER_BYTES = 4 * 1024 * 1024;
const DEFAULT_JOIN_TIMEOUT_MS = 120_000;

type AttachResult =
  | { ok: true; peerId: string }
  | { ok: false; error: ErrorCode };

/**
 * Adds `reason` only when defined. `exactOptionalPropertyTypes` treats an
 * explicit `reason: undefined` as distinct from an omitted key, so this is
 * the one place that bridges an optional `string | undefined` value onto
 * an optional `reason?: string` field.
 */
function withOptionalReason<T extends object>(
  base: T,
  reason: string | undefined,
): T & { reason?: string } {
  return reason !== undefined ? { ...base, reason } : base;
}

export class Room {
  readonly uuid: string;
  private readonly hostToken: string;
  private readonly inviteTokens: ReadonlyMap<string, Exclude<Role, "host">>;
  private readonly sockets = new Map<string, AttachedSocket>();
  private readonly streams = new Map<DocKind, Stream>();
  /**
   * Non-host peers who have connected but haven't been admitted by the
   * host yet. They've received `welcome` but no buffer; they cannot send
   * doc traffic and other peers don't see them. Promoted to active on
   * `join-approved`, dropped on `join-denied` or socket close.
   */
  private readonly pending = new Map<string, PendingState>();
  private hostPeerId: string | null = null;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private graceDeadline: number | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  private readonly gracePeriodMs: number;
  private readonly idleTimeoutMs: number;
  private readonly maxSockets: number;
  private readonly maxBufferBytes: number;
  private readonly joinTimeoutMs: number;
  private readonly onDestroy: ((uuid: string) => void) | undefined;
  private readonly now: () => number;

  constructor(opts: RoomOptions) {
    this.uuid = opts.uuid;
    this.hostToken = opts.hostToken;
    this.inviteTokens = opts.inviteTokens;
    this.gracePeriodMs = opts.gracePeriodMs ?? DEFAULT_GRACE_MS;
    this.idleTimeoutMs = opts.idleTimeoutMs ?? DEFAULT_IDLE_MS;
    this.maxSockets = opts.maxSockets ?? DEFAULT_MAX_SOCKETS;
    this.maxBufferBytes = opts.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES;
    this.joinTimeoutMs = opts.joinTimeoutMs ?? DEFAULT_JOIN_TIMEOUT_MS;
    this.onDestroy = opts.onDestroy;
    this.now = opts.now ?? Date.now;

    for (const kind of DOC_KINDS) {
      this.streams.set(kind, {
        currentStreamId: 1,
        buffer: [],
        bufferBytes: 0,
      });
    }
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  get hostConnected(): boolean {
    return this.hostPeerId !== null;
  }

  authorize(token: string): Role | null {
    if (this.destroyed) return null;
    if (tokensEqual(token, this.hostToken)) return "host";
    return findTokenRole(token, this.inviteTokens.entries()) ?? null;
  }

  attach(socket: SocketLike, role: Role): AttachResult {
    if (this.destroyed) return { ok: false, error: "room-not-found" };
    if (this.sockets.size >= this.maxSockets) {
      return { ok: false, error: "room-full" };
    }
    if (role === "host" && this.hostPeerId !== null) {
      return { ok: false, error: "unauthorized" };
    }

    const peerId = this.mintPeerId();
    this.sockets.set(peerId, { socket, role, peerId });

    if (role === "host") {
      this.hostPeerId = peerId;
      this.cancelGrace();
    } else {
      const timeoutTimer = setTimeout(
        () => this.timeoutPending(peerId),
        this.joinTimeoutMs,
      );
      this.pending.set(peerId, { requestId: null, timeoutTimer });
    }

    // peerCount in welcome reflects only admitted peers (excluding any
    // pending guests, plus the just-attached pending guest).
    const admittedCount = this.sockets.size - this.pending.size;
    this.send(socket, {
      type: "welcome",
      peerId,
      role,
      peerCount: admittedCount + (role === "host" ? 0 : 1),
      hostPresent: this.hostPeerId !== null,
    });

    if (role === "host") {
      // Host gets the buffer immediately and is announced as connected.
      for (const [docKind, stream] of this.streams) {
        if (stream.buffer.length > 0) {
          this.send(socket, {
            type: "buffer",
            docKind,
            streamId: stream.currentStreamId,
            updates: [...stream.buffer],
          });
        }
      }
      this.broadcastSystem({ event: "host_connected" }, peerId);
      this.broadcastSystem({ event: "peer_joined", peerId, role }, peerId);
    }
    // For pending guests, buffer + peer_joined fire on join-approved instead.

    this.resetIdle();

    return { ok: true, peerId };
  }

  detach(peerId: string): void {
    if (this.destroyed) return;
    if (!this.sockets.has(peerId)) return;

    const wasHost = this.hostPeerId === peerId;
    const pending = this.pending.get(peerId);
    this.sockets.delete(peerId);
    this.pending.delete(peerId);

    if (pending) {
      // Pending peer dropped: tell the host so the approval modal can clear.
      // No peer_left broadcast — other peers never knew about this guest.
      if (pending.timeoutTimer) clearTimeout(pending.timeoutTimer);
      if (pending.requestId !== null) {
        this.sendToHost({
          type: "system",
          data: {
            event: "join_request_cancelled",
            requestId: pending.requestId,
          },
        });
      }
    } else {
      this.broadcastSystem({ event: "peer_left", peerId }, peerId);
    }

    if (wasHost) {
      this.hostPeerId = null;
      if (this.sockets.size > 0) {
        this.startGrace();
      } else {
        this.destroy("host_left");
      }
    } else if (this.sockets.size === 0 && !this.hostConnected) {
      this.destroy("idle");
    }
  }

  receive(peerId: string, raw: unknown): void {
    if (this.destroyed) return;
    const entry = this.sockets.get(peerId);
    if (!entry) return;

    const parsed = clientMessageSchema.safeParse(raw);
    if (!parsed.success) {
      this.rejectAndClose(entry, "invalid-message", "Malformed message");
      return;
    }

    const message: ClientMessage = parsed.data;
    if (!canSend(entry.role, message)) {
      this.rejectAndClose(entry, "unauthorized", "Operation not permitted");
      return;
    }

    // Pending guests can only send `join-request`. Anything else is a
    // protocol violation (their key isn't established yet, so doc traffic
    // would be undecryptable anyway).
    if (this.pending.has(peerId) && message.type !== "join-request") {
      this.rejectAndClose(
        entry,
        "join-rejected",
        "Pending guest cannot send doc traffic before approval",
      );
      return;
    }

    this.resetIdle();

    match(message)
      .with({ type: "y-update" }, (m) => {
        const stream = this.streams.get(m.docKind);
        if (!stream) return;
        if (m.streamId !== stream.currentStreamId) return;
        this.appendBuffer(stream, m.payload);
        this.relay(peerId, {
          type: "y-update",
          docKind: m.docKind,
          streamId: m.streamId,
          payload: m.payload,
          from: peerId,
        });
      })
      .with({ type: "awareness" }, (m) => {
        this.relay(peerId, {
          type: "awareness",
          payload: m.payload,
          from: peerId,
        });
      })
      .with({ type: "join-request" }, (m) => {
        const pending = this.pending.get(peerId);
        if (!pending) {
          // Already admitted — reject re-handshake.
          this.send(entry.socket, {
            type: "error",
            code: "join-rejected",
            message: "Already admitted; cannot send another join-request",
          });
          return;
        }
        // Only one outstanding request per pending guest. If they send
        // again, treat the new requestId as the canonical one (cancelling
        // the old).
        if (pending.requestId !== null) {
          this.sendToHost({
            type: "system",
            data: {
              event: "join_request_cancelled",
              requestId: pending.requestId,
            },
          });
        }
        pending.requestId = m.requestId;
        this.sendToHost({
          type: "join-request",
          requestId: m.requestId,
          guestPub: m.guestPub,
          displayName: m.displayName,
          color: m.color,
          from: peerId,
        });
      })
      .with({ type: "join-approved" }, (m) => {
        this.approveJoin(entry, m.to, m.requestId, m.encryptedRoomKey);
      })
      .with({ type: "join-denied" }, (m) => {
        this.denyJoin(entry, m.to, m.requestId, m.reason);
      })
      .with({ type: "kick-peer" }, (m) => {
        this.handleKickPeer(entry, m.peerId);
      })
      .exhaustive();
  }

  private handleKickPeer(host: AttachedSocket, targetPeerId: string): void {
    if (targetPeerId === host.peerId) {
      // Host trying to kick themselves: ignore.
      return;
    }
    const target = this.sockets.get(targetPeerId);
    if (!target) {
      this.send(host.socket, {
        type: "error",
        code: "unauthorized",
        message: "Target peer not found",
      });
      return;
    }
    if (target.role === "host") {
      // Defensive — there should never be a non-self host target.
      this.send(host.socket, {
        type: "error",
        code: "unauthorized",
        message: "Cannot kick the host",
      });
      return;
    }
    this.send(target.socket, {
      type: "error",
      code: "unauthorized",
      message: "Removed by host",
    });
    try {
      target.socket.close(CLOSE_CODES.FORBIDDEN, "kicked");
    } catch {
      // ignore
    }
    // detach() handles the peer_left broadcast (or pending teardown if
    // somehow they were still pending when kicked).
    this.detach(targetPeerId);
  }

  /**
   * Resolves the pending guest a host is approving/denying, rejecting the
   * host's request (and returning null) if the target isn't pending or the
   * requestId is stale. Shared by `approveJoin` and `denyJoin`.
   */
  private takePending(
    host: AttachedSocket,
    targetPeerId: string,
    requestId: string,
  ): { target: AttachedSocket; pending: PendingState } | null {
    const target = this.sockets.get(targetPeerId);
    const pending = this.pending.get(targetPeerId);
    if (!target || !pending) {
      this.send(host.socket, {
        type: "error",
        code: "join-rejected",
        message: "Target guest is not pending",
      });
      return null;
    }
    if (pending.requestId !== requestId) {
      this.send(host.socket, {
        type: "error",
        code: "join-rejected",
        message: "Request id does not match the pending guest's request",
      });
      return null;
    }
    return { target, pending };
  }

  private approveJoin(
    host: AttachedSocket,
    targetPeerId: string,
    requestId: string,
    encryptedRoomKey: string,
  ): void {
    const resolved = this.takePending(host, targetPeerId, requestId);
    if (!resolved) return;
    const { target, pending } = resolved;

    // Promote out of pending FIRST so the buffer + peer_joined paths
    // count this peer as admitted.
    if (pending.timeoutTimer) clearTimeout(pending.timeoutTimer);
    this.pending.delete(targetPeerId);
    this.send(target.socket, {
      type: "join-approved",
      requestId,
      encryptedRoomKey,
    });
    // Catch the new peer up on the buffer.
    for (const [docKind, stream] of this.streams) {
      if (stream.buffer.length > 0) {
        this.send(target.socket, {
          type: "buffer",
          docKind,
          streamId: stream.currentStreamId,
          updates: [...stream.buffer],
        });
      }
    }
    // Announce them to everyone else (host included).
    this.broadcastSystem(
      { event: "peer_joined", peerId: targetPeerId, role: target.role },
      targetPeerId,
    );
  }

  private denyJoin(
    host: AttachedSocket,
    targetPeerId: string,
    requestId: string,
    reason: string | undefined,
  ): void {
    const resolved = this.takePending(host, targetPeerId, requestId);
    if (!resolved) return;
    const { target, pending } = resolved;

    this.send(
      target.socket,
      withOptionalReason({ type: "join-denied", requestId }, reason),
    );
    // Tear the pending guest down without triggering the
    // join_request_cancelled path in detach() — the host just denied,
    // so a follow-up "cancelled" would be misleading.
    if (pending.timeoutTimer) clearTimeout(pending.timeoutTimer);
    this.pending.delete(targetPeerId);
    this.sockets.delete(targetPeerId);
    try {
      target.socket.close(CLOSE_CODES.FORBIDDEN, "join-denied");
    } catch {
      // ignore
    }
  }

  private sendToHost(message: ServerMessage): void {
    if (this.hostPeerId === null) return;
    const host = this.sockets.get(this.hostPeerId);
    if (!host) return;
    this.send(host.socket, message);
  }

  private timeoutPending(peerId: string): void {
    if (this.destroyed) return;
    const pending = this.pending.get(peerId);
    const entry = this.sockets.get(peerId);
    if (!pending || !entry) return;

    // Tell the host (if any) that the request is gone, so the approval
    // modal clears.
    if (pending.requestId !== null) {
      this.sendToHost({
        type: "system",
        data: {
          event: "join_request_cancelled",
          requestId: pending.requestId,
        },
      });
    }

    // Tell the guest why their socket is closing.
    this.send(entry.socket, {
      type: "error",
      code: "join-timeout",
      message: "Host did not respond in time",
    });

    // Tear down WITHOUT going through detach() — we already notified the
    // host (or skipped that if no host yet).
    this.pending.delete(peerId);
    this.sockets.delete(peerId);
    try {
      entry.socket.close(CLOSE_CODES.FORBIDDEN, "join-timeout");
    } catch {
      // ignore
    }

    if (this.sockets.size === 0 && !this.hostConnected) {
      this.destroy("idle");
    }
  }

  destroy(
    reason: Extract<SystemEvent, { event: "session_ended" }>["reason"],
  ): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelGrace();
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    for (const pending of this.pending.values()) {
      if (pending.timeoutTimer) clearTimeout(pending.timeoutTimer);
    }
    this.pending.clear();

    const farewell: ServerMessage = {
      type: "system",
      data: { event: "session_ended", reason },
    };
    for (const { socket } of this.sockets.values()) {
      try {
        this.send(socket, farewell);
      } catch {
        // ignore
      }
      try {
        socket.close(CLOSE_CODES.SESSION_ENDED, "session-ended");
      } catch {
        // ignore
      }
    }
    this.sockets.clear();
    this.hostPeerId = null;
    this.streams.clear();

    this.onDestroy?.(this.uuid);
  }

  private rejectAndClose(
    entry: AttachedSocket,
    code: ErrorCode,
    message: string,
  ): void {
    this.send(entry.socket, { type: "error", code, message });
    try {
      entry.socket.close(
        code === "payload-too-large"
          ? CLOSE_CODES.MESSAGE_TOO_BIG
          : CLOSE_CODES.FORBIDDEN,
        code,
      );
    } catch {
      // ignore
    }
    this.detach(entry.peerId);
  }

  private appendBuffer(stream: Stream, payload: string): void {
    const size = Buffer.byteLength(payload, "utf8");
    stream.buffer.push(payload);
    stream.bufferBytes += size;
    while (
      stream.bufferBytes > this.maxBufferBytes &&
      stream.buffer.length > 1
    ) {
      const removed = stream.buffer.shift();
      if (removed) stream.bufferBytes -= Buffer.byteLength(removed, "utf8");
    }
  }

  private relay(fromPeerId: string, message: ServerMessage): void {
    for (const { socket, peerId } of this.sockets.values()) {
      if (peerId === fromPeerId) continue;
      this.send(socket, message);
    }
  }

  private broadcastSystem(data: SystemEvent, exceptPeerId?: string): void {
    const message: ServerMessage = { type: "system", data };
    for (const { socket, peerId } of this.sockets.values()) {
      if (peerId === exceptPeerId) continue;
      this.send(socket, message);
    }
  }

  private send(socket: SocketLike, message: ServerMessage): void {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      // socket likely closed; let detach handle it
    }
  }

  private startGrace(): void {
    this.cancelGrace();
    this.graceDeadline = this.now() + this.gracePeriodMs;
    this.broadcastSystem({
      event: "host_disconnected",
      deadline: this.graceDeadline,
    });
    this.graceTimer = setTimeout(() => {
      this.graceTimer = null;
      this.graceDeadline = null;
      if (!this.hostConnected) this.destroy("host_left");
    }, this.gracePeriodMs);
  }

  private cancelGrace(): void {
    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
    this.graceDeadline = null;
  }

  private resetIdle(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      this.destroy("idle");
    }, this.idleTimeoutMs);
  }

  private mintPeerId(): string {
    for (let i = 0; i < 8; i++) {
      const id = randomBytes(PEER_ID_BYTES).toString("base64url");
      if (!this.sockets.has(id)) return id;
    }
    throw new Error("Failed to mint unique peer id");
  }
}
