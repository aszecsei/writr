import { randomBytes } from "node:crypto";
import {
  CLOSE_CODES,
  canSend,
  type ClientMessage,
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

const PEER_ID_BYTES = 8;
const DEFAULT_GRACE_MS = 60_000;
const DEFAULT_IDLE_MS = 30 * 60_000;
const DEFAULT_MAX_SOCKETS = 16;
const DEFAULT_MAX_BUFFER_BYTES = 4 * 1024 * 1024;

export type AttachResult =
  | { ok: true; peerId: string }
  | { ok: false; error: ErrorCode };

export class Room {
  readonly uuid: string;
  private readonly hostToken: string;
  private readonly inviteTokens: ReadonlyMap<string, Exclude<Role, "host">>;
  private readonly sockets = new Map<string, AttachedSocket>();
  private readonly streams = new Map<DocKind, Stream>();
  private hostPeerId: string | null = null;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private graceDeadline: number | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  private readonly gracePeriodMs: number;
  private readonly idleTimeoutMs: number;
  private readonly maxSockets: number;
  private readonly maxBufferBytes: number;
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

  get peerCount(): number {
    return this.sockets.size;
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
    }

    this.send(socket, {
      type: "welcome",
      peerId,
      role,
      peerCount: this.sockets.size,
      hostPresent: this.hostPeerId !== null,
    });

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

    if (role === "host") {
      this.broadcastSystem({ event: "host_connected" }, peerId);
    }
    this.broadcastSystem({ event: "peer_joined", peerId, role }, peerId);

    this.resetIdle();

    return { ok: true, peerId };
  }

  detach(peerId: string): void {
    if (this.destroyed) return;
    if (!this.sockets.has(peerId)) return;

    const wasHost = this.hostPeerId === peerId;
    this.sockets.delete(peerId);
    this.broadcastSystem({ event: "peer_left", peerId }, peerId);

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
    const gate = canSend(entry.role, message);
    if (!gate.allowed) {
      this.rejectAndClose(entry, gate.reason, "Operation not permitted");
      return;
    }

    this.resetIdle();

    switch (message.type) {
      case "y-update": {
        const stream = this.streams.get(message.docKind);
        if (!stream) return;
        if (message.streamId !== stream.currentStreamId) return;
        this.appendBuffer(stream, message.payload);
        this.relay(peerId, {
          type: "y-update",
          docKind: message.docKind,
          streamId: message.streamId,
          payload: message.payload,
          from: peerId,
        });
        return;
      }
      case "awareness": {
        this.relay(peerId, {
          type: "awareness",
          payload: message.payload,
          from: peerId,
        });
        return;
      }
      case "meta": {
        this.relay(peerId, {
          type: "meta",
          streamId: message.streamId,
          payload: message.payload,
          from: peerId,
        });
        return;
      }
      case "rotate-stream": {
        const stream = this.streams.get(message.docKind);
        if (!stream) return;
        if (message.newStreamId <= stream.currentStreamId) return;
        stream.currentStreamId = message.newStreamId;
        stream.buffer = [];
        stream.bufferBytes = 0;
        this.broadcast({
          type: "rotate-stream",
          docKind: message.docKind,
          newStreamId: message.newStreamId,
        });
        return;
      }
      case "request-buffer": {
        const stream = this.streams.get(message.docKind);
        if (!stream) return;
        this.send(entry.socket, {
          type: "buffer",
          docKind: message.docKind,
          streamId: stream.currentStreamId,
          updates: [...stream.buffer],
        });
        return;
      }
    }
  }

  destroy(reason: Extract<SystemEvent, { event: "session_ended" }>["reason"]): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelGrace();
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

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
    while (stream.bufferBytes > this.maxBufferBytes && stream.buffer.length > 1) {
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

  private broadcast(message: ServerMessage): void {
    for (const { socket } of this.sockets.values()) {
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
