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
}

export interface CollabClientOptions {
  transport: CollabTransport;
  key: RoomKey;
  role: Role;
}

const DEFAULT_STREAM_ID = 1;

export class CollabClient {
  readonly role: Role;
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
    this.role = opts.role;
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

    switch (message.type) {
      case "welcome":
        this.peerIdValue = message.peerId;
        this.emit("welcome", {
          peerId: message.peerId,
          role: message.role,
          peerCount: message.peerCount,
          hostPresent: message.hostPresent,
        });
        return;

      case "y-update": {
        const update = await this.tryDecrypt(message.payload, "y-update");
        if (!update) return;
        this.emit("y-update", {
          docKind: message.docKind,
          streamId: message.streamId,
          update,
          from: message.from,
        });
        return;
      }

      case "awareness": {
        const update = await this.tryDecrypt(message.payload, "awareness");
        if (!update) return;
        this.emit("awareness", { update, from: message.from });
        return;
      }

      case "meta": {
        const plaintext = await this.tryDecrypt(message.payload, "meta");
        if (!plaintext) return;
        this.emit("meta", {
          streamId: message.streamId,
          plaintext,
          from: message.from,
        });
        return;
      }

      case "rotate-stream":
        this.streamIds.set(message.docKind, message.newStreamId);
        this.emit("rotate-stream", {
          docKind: message.docKind,
          newStreamId: message.newStreamId,
        });
        return;

      case "buffer": {
        this.streamIds.set(message.docKind, message.streamId);
        const updates: Uint8Array[] = [];
        for (const encoded of message.updates) {
          const u = await this.tryDecrypt(encoded, "buffer");
          if (u) updates.push(u);
        }
        this.emit("buffer", {
          docKind: message.docKind,
          streamId: message.streamId,
          updates,
        });
        return;
      }

      case "system":
        this.emit("system", message.data);
        return;

      case "error":
        this.emit("error", { kind: message.code, message: message.message });
        return;
    }
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
