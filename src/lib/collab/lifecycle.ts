import { CollabClient } from "./client";
import { wsToHttpOrigin } from "./config";
import {
  buildShareUrl,
  exportRoomKey,
  generateRoomKey,
  importRoomKey,
} from "./crypto";
import type { Role } from "./protocol";
import { CollabSession } from "./session";
import {
  createWebSocketTransport,
  type WebSocketLike,
  wireWebSocketToClient,
} from "./transport";

export interface MintedRoom {
  roomUuid: string;
  hostToken: string;
  inviteTokens: {
    edit: string;
    review: string;
    view: string;
  };
}

export type WebSocketFactory = (url: string) => WebSocketLike;

const defaultWsFactory: WebSocketFactory = (url) => {
  if (typeof WebSocket === "undefined") {
    throw new Error(
      "WebSocket is not available in this environment; pass a `wsFactory` to connectAs*",
    );
  }
  return new WebSocket(url) as unknown as WebSocketLike;
};

function defaultAppOrigin(): string {
  if (
    typeof window !== "undefined" &&
    typeof window.location !== "undefined" &&
    window.location.origin
  ) {
    return window.location.origin;
  }
  return "";
}

export interface MintRoomOptions {
  baseUrl: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}

export async function mintRoom(opts: MintRoomOptions): Promise<MintedRoom> {
  const httpOrigin = wsToHttpOrigin(opts.baseUrl);
  const f = opts.fetchFn ?? globalThis.fetch;
  const init: RequestInit = { method: "POST" };
  if (opts.signal) init.signal = opts.signal;
  let res: Response;
  try {
    res = await f(`${httpOrigin}/rooms`, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Network error contacting collab relay: ${message}`);
  }
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Rate limited by collab relay");
    }
    throw new Error(`Collab relay returned ${res.status}`);
  }
  return (await res.json()) as MintedRoom;
}

export interface ConnectAsHostOptions {
  baseUrl: string;
  appOrigin?: string;
  fetchFn?: typeof fetch;
  wsFactory?: WebSocketFactory;
  signal?: AbortSignal;
}

export interface ShareUrls {
  edit: string;
  review: string;
  view: string;
}

export interface HostConnection {
  client: CollabClient;
  session: CollabSession;
  roomUuid: string;
  hostToken: string;
  keyEncoded: string;
  shareUrls: ShareUrls;
  peerId: string;
  peerCount: number;
}

export async function connectAsHost(
  opts: ConnectAsHostOptions,
): Promise<HostConnection> {
  const mintArgs: MintRoomOptions = { baseUrl: opts.baseUrl };
  if (opts.fetchFn) mintArgs.fetchFn = opts.fetchFn;
  if (opts.signal) mintArgs.signal = opts.signal;
  const room = await mintRoom(mintArgs);

  const key = await generateRoomKey();
  const keyEncoded = await exportRoomKey(key);

  const wsUrl = `${opts.baseUrl}/room/${room.roomUuid}?t=${encodeURIComponent(room.hostToken)}`;
  const ws = (opts.wsFactory ?? defaultWsFactory)(wsUrl);
  const transport = createWebSocketTransport(ws);
  const client = new CollabClient({ transport, key, role: "host" });
  wireWebSocketToClient(ws, client);

  let hostWelcome: Awaited<ReturnType<typeof waitForWelcome>>;
  try {
    hostWelcome = await waitForWelcome(client, opts.signal);
  } catch (err) {
    client.close();
    throw err;
  }

  const session = new CollabSession({ client });
  const appOrigin = opts.appOrigin ?? defaultAppOrigin();

  const shareUrls: ShareUrls = {
    edit: buildShareUrl({
      origin: appOrigin,
      roomUuid: room.roomUuid,
      token: room.inviteTokens.edit,
      keyEncoded,
    }),
    review: buildShareUrl({
      origin: appOrigin,
      roomUuid: room.roomUuid,
      token: room.inviteTokens.review,
      keyEncoded,
    }),
    view: buildShareUrl({
      origin: appOrigin,
      roomUuid: room.roomUuid,
      token: room.inviteTokens.view,
      keyEncoded,
    }),
  };

  return {
    client,
    session,
    roomUuid: room.roomUuid,
    hostToken: room.hostToken,
    keyEncoded,
    shareUrls,
    peerId: hostWelcome.peerId,
    peerCount: hostWelcome.peerCount,
  };
}

export interface ConnectAsGuestOptions {
  baseUrl: string;
  roomUuid: string;
  token: string;
  keyEncoded: string;
  wsFactory?: WebSocketFactory;
  signal?: AbortSignal;
}

export interface GuestConnection {
  client: CollabClient;
  session: CollabSession;
  role: Role;
  peerId: string;
  hostPresent: boolean;
  peerCount: number;
}

export async function connectAsGuest(
  opts: ConnectAsGuestOptions,
): Promise<GuestConnection> {
  const key = await importRoomKey(opts.keyEncoded);
  const wsUrl = `${opts.baseUrl}/room/${opts.roomUuid}?t=${encodeURIComponent(opts.token)}`;
  const ws = (opts.wsFactory ?? defaultWsFactory)(wsUrl);
  const transport = createWebSocketTransport(ws);
  const client = new CollabClient({ transport, key });
  wireWebSocketToClient(ws, client);

  let welcome: Awaited<ReturnType<typeof waitForWelcome>>;
  try {
    welcome = await waitForWelcome(client, opts.signal);
  } catch (err) {
    client.close();
    throw err;
  }

  const session = new CollabSession({ client });
  return {
    client,
    session,
    role: welcome.role,
    peerId: welcome.peerId,
    hostPresent: welcome.hostPresent,
    peerCount: welcome.peerCount,
  };
}

interface WelcomeData {
  peerId: string;
  role: Role;
  peerCount: number;
  hostPresent: boolean;
}

const FATAL_ERROR_KINDS = new Set([
  "transport",
  "unauthorized",
  "room-not-found",
  "room-full",
  "rate-limited",
  "invalid-token",
]);

function waitForWelcome(
  client: CollabClient,
  signal?: AbortSignal,
): Promise<WelcomeData> {
  return new Promise<WelcomeData>((resolve, reject) => {
    const cleanups: Array<() => void> = [];
    const cleanup = () => {
      for (const c of cleanups) c();
      cleanups.length = 0;
      if (signal) signal.removeEventListener("abort", onAbort);
    };

    cleanups.push(
      client.on("welcome", (data) => {
        cleanup();
        resolve(data);
      }),
    );
    cleanups.push(
      client.on("close", ({ code, reason }) => {
        cleanup();
        reject(
          new Error(
            `Collab connection closed before welcome (${code}${reason ? `: ${reason}` : ""})`,
          ),
        );
      }),
    );
    cleanups.push(
      client.on("error", (event) => {
        if (FATAL_ERROR_KINDS.has(event.kind)) {
          cleanup();
          reject(new Error(`Collab connection failed: ${event.kind}`));
        }
      }),
    );

    const onAbort = () => {
      cleanup();
      client.close(1000, "aborted");
      reject(new Error("Collab connection aborted"));
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort);
    }
  });
}
