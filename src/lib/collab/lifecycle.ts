import { CollabClient } from "./client";
import { wsToHttpOrigin } from "./config";
import {
  buildShareUrl,
  generateRoomKey,
  generateX25519Keypair,
  type ShareMode,
} from "./crypto";
import { runGuestHandshake } from "./handshake";
import { isFatalErrorKind, type Role } from "./protocol";
import { CollabSession } from "./session";
import { type WebSocketLike, wireWebSocketToClient } from "./transport";

interface MintedRoom {
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

interface MintRoomOptions {
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

interface ConnectAsHostOptions {
  baseUrl: string;
  appOrigin?: string;
  fetchFn?: typeof fetch;
  wsFactory?: WebSocketFactory;
  signal?: AbortSignal;
  /** When true, the share URLs encode `mode=project` so guests mount the
   *  read-only project shell instead of the active-chapter editor. The
   *  host's role-based tokens (edit/review/view) still apply to the
   *  active chapter. */
  projectMode?: boolean;
}

export interface ShareUrls {
  mode: ShareMode;
  edit: string;
  review: string;
  view: string;
}

interface HostConnection {
  client: CollabClient;
  session: CollabSession;
  roomUuid: string;
  hostPriv: CryptoKey;
  hostPubEncoded: string;
  roomKey: CryptoKey;
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

  const roomKey = await generateRoomKey();
  const hostKeypair = await generateX25519Keypair();

  const wsUrl = `${opts.baseUrl}/room/${room.roomUuid}?t=${encodeURIComponent(room.hostToken)}`;
  const ws = (opts.wsFactory ?? defaultWsFactory)(wsUrl);
  const client = new CollabClient({
    transport: ws,
    key: roomKey,
    role: "host",
  });
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

  const mode: ShareMode = opts.projectMode ? "project" : "chapter";
  const shareUrls: ShareUrls = {
    mode,
    edit: buildShareUrl({
      origin: appOrigin,
      roomUuid: room.roomUuid,
      token: room.inviteTokens.edit,
      hostPubEncoded: hostKeypair.pubEncoded,
      mode,
    }),
    review: buildShareUrl({
      origin: appOrigin,
      roomUuid: room.roomUuid,
      token: room.inviteTokens.review,
      hostPubEncoded: hostKeypair.pubEncoded,
      mode,
    }),
    view: buildShareUrl({
      origin: appOrigin,
      roomUuid: room.roomUuid,
      token: room.inviteTokens.view,
      hostPubEncoded: hostKeypair.pubEncoded,
      mode,
    }),
  };

  return {
    client,
    session,
    roomUuid: room.roomUuid,
    hostPriv: hostKeypair.priv,
    hostPubEncoded: hostKeypair.pubEncoded,
    roomKey,
    shareUrls,
    peerId: hostWelcome.peerId,
    peerCount: hostWelcome.peerCount,
  };
}

interface ConnectAsGuestOptions {
  baseUrl: string;
  roomUuid: string;
  token: string;
  hostPubEncoded: string;
  displayName: string;
  color: string;
  wsFactory?: WebSocketFactory;
  signal?: AbortSignal;
}

interface GuestConnection {
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
  const wsUrl = `${opts.baseUrl}/room/${opts.roomUuid}?t=${encodeURIComponent(opts.token)}`;
  const ws = (opts.wsFactory ?? defaultWsFactory)(wsUrl);

  const handshakeOpts: Parameters<typeof runGuestHandshake>[0] = {
    ws,
    roomUuid: opts.roomUuid,
    hostPubEncoded: opts.hostPubEncoded,
    displayName: opts.displayName,
    color: opts.color,
  };
  if (opts.signal) handshakeOpts.signal = opts.signal;

  let result: Awaited<ReturnType<typeof runGuestHandshake>>;
  try {
    result = await runGuestHandshake(handshakeOpts);
  } catch (err) {
    try {
      ws.close(1000, "handshake-failed");
    } catch {
      // ignore
    }
    throw err;
  }

  const client = new CollabClient({
    transport: ws,
    key: result.roomKey,
    role: result.welcome.role,
  });
  wireWebSocketToClient(ws, client);

  // Replay any messages that arrived between welcome and join-approved.
  for (const raw of result.bufferedMessages) {
    void client.handleMessage(raw);
  }

  const session = new CollabSession({ client });
  return {
    client,
    session,
    role: result.welcome.role,
    peerId: result.welcome.peerId,
    hostPresent: result.welcome.hostPresent,
    peerCount: result.welcome.peerCount,
  };
}

interface WelcomeData {
  peerId: string;
  role: Role;
  peerCount: number;
  hostPresent: boolean;
}

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
        if (isFatalErrorKind(event.kind)) {
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
