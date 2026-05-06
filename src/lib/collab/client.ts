import { match } from "ts-pattern";
import { decryptPayload, encryptPayload, type RoomKey } from "./crypto";
import {
  CLOSE_CODES,
  type ClientMessage,
  canSendClient,
  type DocKind,
  type ErrorCode,
  type Role,
  type ServerMessage,
  type SystemEvent,
  serverMessageSchema,
} from "./protocol";

export interface CollabTransport {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type ClientErrorKind =
  | ErrorCode
  | "transport"
  | "invalid-message"
  | "decrypt"
  | "send-not-allowed";

export interface ClientErrorEvent {
  kind: ClientErrorKind;
  message: string;
}

export interface ClientEventMap {
  open: () => void;
  welcome: (data: {
    peerId: string;
    role: Role;
    peerCount: number;
    hostPresent: boolean;
  }) => void;
  "y-update": (data: {
    docKind: DocKind;
    streamId: number;
    update: Uint8Array;
    from: string;
  }) => void;
  awareness: (data: { update: Uint8Array; from: string }) => void;
  meta: (data: {
    streamId: number;
    plaintext: Uint8Array;
    from: string;
  }) => void;
  "rotate-stream": (data: { docKind: DocKind; newStreamId: number }) => void;
  buffer: (data: {
    docKind: DocKind;
    streamId: number;
    updates: Uint8Array[];
  }) => void;
  system: (event: SystemEvent) => void;
  error: (event: ClientErrorEvent) => void;
  close: (data: { code: number; reason: string }) => void;
  "join-request": (data: {
    requestId: string;
    guestPub: string;
    displayName: string;
    color: string;
    from: string;
  }) => void;
  "join-approved": (data: {
    requestId: string;
    encryptedRoomKey: string;
  }) => void;
  "join-denied": (data: { requestId: string; reason?: string }) => void;
}

export interface CollabClientOptions {
  transport: CollabTransport;
  key: RoomKey;
  /**
   * Role hint at construction. Used for client-side outgoing gating until the
   * server confirms the actual role in its `welcome` message. Defaults to
   * `"view"` (most restrictive) so unknown-role guests don't accidentally
   * send anything before welcome arrives. The server is always authoritative.
   */
  role?: Role;
}

const DEFAULT_STREAM_ID = 1;

export class CollabClient {
  private roleValue: Role;
  private readonly transport: CollabTransport;
  private readonly key: RoomKey;
  private readonly listeners = new Map<
    keyof ClientEventMap,
    Set<(...args: unknown[]) => unknown>
  >();
  private readonly streamIds = new Map<DocKind, number>([
    ["prose", DEFAULT_STREAM_ID],
    ["comments", DEFAULT_STREAM_ID],
  ]);
  private peerIdValue: string | null = null;
  private closed = false;

  constructor(opts: CollabClientOptions) {
    this.transport = opts.transport;
    this.key = opts.key;
    this.roleValue = opts.role ?? "view";
  }

  get role(): Role {
    return this.roleValue;
  }

  get peerId(): string | null {
    return this.peerIdValue;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  streamIdFor(docKind: DocKind): number {
    return this.streamIds.get(docKind) ?? DEFAULT_STREAM_ID;
  }

  on<K extends keyof ClientEventMap>(
    type: K,
    cb: ClientEventMap[K],
  ): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(cb as (...args: unknown[]) => unknown);
    return () => {
      set?.delete(cb as (...args: unknown[]) => unknown);
    };
  }

  handleOpen(): void {
    this.emit("open");
  }

  async handleMessage(raw: string): Promise<void> {
    if (this.closed) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.emit("error", {
        kind: "invalid-message",
        message: "Server sent invalid JSON",
      });
      return;
    }
    const result = serverMessageSchema.safeParse(parsed);
    if (!result.success) {
      this.emit("error", {
        kind: "invalid-message",
        message: "Server message failed schema validation",
      });
      return;
    }
    const message: ServerMessage = result.data;

    await match(message)
      .with({ type: "welcome" }, async (m) => {
        this.peerIdValue = m.peerId;
        this.roleValue = m.role;
        this.emit("welcome", {
          peerId: m.peerId,
          role: m.role,
          peerCount: m.peerCount,
          hostPresent: m.hostPresent,
        });
      })
      .with({ type: "y-update" }, async (m) => {
        const update = await this.tryDecrypt(m.payload, "y-update");
        if (!update) return;
        this.emit("y-update", {
          docKind: m.docKind,
          streamId: m.streamId,
          update,
          from: m.from,
        });
      })
      .with({ type: "awareness" }, async (m) => {
        const update = await this.tryDecrypt(m.payload, "awareness");
        if (!update) return;
        this.emit("awareness", { update, from: m.from });
      })
      .with({ type: "meta" }, async (m) => {
        const plaintext = await this.tryDecrypt(m.payload, "meta");
        if (!plaintext) return;
        this.emit("meta", {
          streamId: m.streamId,
          plaintext,
          from: m.from,
        });
      })
      .with({ type: "rotate-stream" }, async (m) => {
        this.streamIds.set(m.docKind, m.newStreamId);
        this.emit("rotate-stream", {
          docKind: m.docKind,
          newStreamId: m.newStreamId,
        });
      })
      .with({ type: "buffer" }, async (m) => {
        this.streamIds.set(m.docKind, m.streamId);
        const updates: Uint8Array[] = [];
        for (const encoded of m.updates) {
          const u = await this.tryDecrypt(encoded, "buffer");
          if (u) updates.push(u);
        }
        this.emit("buffer", {
          docKind: m.docKind,
          streamId: m.streamId,
          updates,
        });
      })
      .with({ type: "system" }, async (m) => {
        this.emit("system", m.data);
      })
      .with({ type: "error" }, async (m) => {
        this.emit("error", { kind: m.code, message: m.message });
      })
      .with({ type: "join-request" }, async (m) => {
        this.emit("join-request", {
          requestId: m.requestId,
          guestPub: m.guestPub,
          displayName: m.displayName,
          color: m.color,
          from: m.from,
        });
      })
      .with({ type: "join-approved" }, async (m) => {
        this.emit("join-approved", {
          requestId: m.requestId,
          encryptedRoomKey: m.encryptedRoomKey,
        });
      })
      .with({ type: "join-denied" }, async (m) => {
        this.emit("join-denied", {
          requestId: m.requestId,
          reason: m.reason,
        });
      })
      .exhaustive();
  }

  handleClose(code: number, reason: string): void {
    if (this.closed) return;
    this.closed = true;
    this.emit("close", { code, reason });
  }

  handleTransportError(err: Error): void {
    this.emit("error", { kind: "transport", message: err.message });
  }

  async sendYUpdate(docKind: DocKind, update: Uint8Array): Promise<void> {
    const message: ClientMessage = {
      type: "y-update",
      docKind,
      streamId: this.streamIdFor(docKind),
      payload: await encryptPayload(this.key, update),
    };
    this.dispatch(message);
  }

  async sendAwareness(update: Uint8Array): Promise<void> {
    const message: ClientMessage = {
      type: "awareness",
      payload: await encryptPayload(this.key, update),
    };
    this.dispatch(message);
  }

  async sendMeta(streamId: number, plaintext: Uint8Array): Promise<void> {
    const message: ClientMessage = {
      type: "meta",
      streamId,
      payload: await encryptPayload(this.key, plaintext),
    };
    this.dispatch(message);
  }

  rotateStream(docKind: DocKind, newStreamId: number): void {
    this.streamIds.set(docKind, newStreamId);
    this.dispatch({ type: "rotate-stream", docKind, newStreamId });
  }

  requestBuffer(docKind: DocKind): void {
    this.dispatch({ type: "request-buffer", docKind });
  }

  sendJoinRequest(data: {
    requestId: string;
    guestPub: string;
    displayName: string;
    color: string;
  }): void {
    this.dispatch({
      type: "join-request",
      requestId: data.requestId,
      guestPub: data.guestPub,
      displayName: data.displayName,
      color: data.color,
    });
  }

  sendJoinApproved(data: {
    requestId: string;
    encryptedRoomKey: string;
    to: string;
  }): void {
    this.dispatch({
      type: "join-approved",
      requestId: data.requestId,
      encryptedRoomKey: data.encryptedRoomKey,
      to: data.to,
    });
  }

  sendJoinDenied(data: {
    requestId: string;
    reason?: string;
    to: string;
  }): void {
    this.dispatch({
      type: "join-denied",
      requestId: data.requestId,
      reason: data.reason,
      to: data.to,
    });
  }

  close(
    code: number = CLOSE_CODES.NORMAL,
    reason: string = "client-close",
  ): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.transport.close(code, reason);
    } catch {
      // ignore
    }
    this.emit("close", { code, reason });
  }

  private dispatch(message: ClientMessage): void {
    if (this.closed) return;
    if (!canSendClient(this.role, message)) {
      this.emit("error", {
        kind: "send-not-allowed",
        message: `Role '${this.role}' cannot send '${message.type}'`,
      });
      return;
    }
    try {
      this.transport.send(JSON.stringify(message));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit("error", { kind: "transport", message });
    }
  }

  private async tryDecrypt(
    encoded: string,
    label: string,
  ): Promise<Uint8Array | null> {
    try {
      return await decryptPayload(this.key, encoded);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit("error", {
        kind: "decrypt",
        message: `Failed to decrypt ${label}: ${message}`,
      });
      return null;
    }
  }

  private emit<K extends keyof ClientEventMap>(
    type: K,
    ...args: Parameters<ClientEventMap[K]>
  ): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const cb of set) {
      try {
        cb(...args);
      } catch {
        // listener errors must not break the bus
      }
    }
  }
}
