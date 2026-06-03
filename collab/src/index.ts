import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket as WS } from "ws";
import { CLOSE_CODES, MAX_PAYLOAD_BYTES, type Role } from "./protocol.js";
import { RateLimiter } from "./rate-limit.js";
import { Room, type SocketLike } from "./room.js";
import { mintToken } from "./tokens.js";

const PORT = Number(process.env.PORT ?? 4444);
const HOST = process.env.HOST ?? "0.0.0.0";
const ALLOWED_ORIGINS_RAW = process.env.ALLOWED_ORIGINS ?? "";
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_RAW.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOW_ANY_ORIGIN = ALLOWED_ORIGINS.includes("*");
const GRACE_MS = Number(process.env.GRACE_PERIOD_MS ?? 60_000);
const IDLE_MS = Number(process.env.IDLE_TIMEOUT_MS ?? 30 * 60_000);
const MAX_SOCKETS_PER_ROOM = Number(process.env.MAX_SOCKETS_PER_ROOM ?? 16);
const ROOM_CREATE_PER_HOUR = Number(process.env.ROOM_CREATE_PER_HOUR ?? 5);
const MAX_BUFFER_BYTES = Number(
  process.env.MAX_BUFFER_BYTES ?? 4 * 1024 * 1024,
);

const rooms = new Map<string, Room>();
const roomLimiter = new RateLimiter({
  windowMs: 60 * 60_000,
  max: ROOM_CREATE_PER_HOUR,
});

function isAllowedOrigin(origin: string | undefined): boolean {
  if (ALLOW_ANY_ORIGIN) return true;
  if (ALLOWED_ORIGINS.length === 0) return false;
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

function getClientIp(req: IncomingMessage): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? "unknown";
}

function corsHeaders(origin: string | undefined): Record<string, string> {
  if (!isAllowedOrigin(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    Vary: "Origin",
  };
}

const httpServer = createServer((req, res) => {
  const origin = req.headers.origin;

  if (req.method === "OPTIONS") {
    if (isAllowedOrigin(origin)) {
      res.writeHead(204, {
        ...corsHeaders(origin),
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      });
    } else {
      res.writeHead(403);
    }
    res.end();
    return;
  }

  if (req.url === "/healthz" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }

  if (req.url === "/rooms" && req.method === "POST") {
    if (!isAllowedOrigin(origin)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const ip = getClientIp(req);
    const limit = roomLimiter.check(ip);
    if (!limit.allowed) {
      res.writeHead(429, {
        ...corsHeaders(origin),
        "Content-Type": "application/json",
        "Retry-After": Math.ceil(limit.retryAfterMs / 1000).toString(),
      });
      res.end(JSON.stringify({ error: "rate-limited" }));
      return;
    }

    const roomUuid = randomUUID();
    const hostToken = mintToken();
    const editToken = mintToken();
    const reviewToken = mintToken();
    const viewToken = mintToken();

    const inviteTokens = new Map<string, "view" | "review" | "edit">([
      [editToken, "edit"],
      [reviewToken, "review"],
      [viewToken, "view"],
    ]);

    const room = new Room({
      uuid: roomUuid,
      hostToken,
      inviteTokens,
      gracePeriodMs: GRACE_MS,
      idleTimeoutMs: IDLE_MS,
      maxSockets: MAX_SOCKETS_PER_ROOM,
      maxBufferBytes: MAX_BUFFER_BYTES,
      onDestroy: (uuid) => {
        rooms.delete(uuid);
        log("room_destroyed", { uuid });
      },
    });
    rooms.set(roomUuid, room);
    log("room_created", { uuid: roomUuid });

    res.writeHead(201, {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
    });
    res.end(
      JSON.stringify({
        roomUuid,
        hostToken,
        inviteTokens: {
          edit: editToken,
          review: reviewToken,
          view: viewToken,
        },
      }),
    );
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: MAX_PAYLOAD_BYTES,
});

httpServer.on("upgrade", (req, socket, head) => {
  rejectOrUpgrade(req, socket, head);
});

function rejectOrUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
): void {
  const reject = (status: number, reason: string) => {
    socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
  };

  if (!isAllowedOrigin(req.headers.origin)) {
    reject(403, "Forbidden");
    return;
  }

  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`,
  );
  const match = /^\/room\/([a-f0-9-]{36})$/.exec(url.pathname);
  if (!match?.[1]) {
    reject(404, "Not Found");
    return;
  }

  const roomUuid = match[1];
  const token = url.searchParams.get("t");
  if (!token) {
    reject(401, "Unauthorized");
    return;
  }

  const room = rooms.get(roomUuid);
  if (!room || room.isDestroyed) {
    reject(404, "Not Found");
    return;
  }

  const role = room.authorize(token);
  if (!role) {
    reject(401, "Unauthorized");
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    handleConnection(ws, room, role);
  });
}

function handleConnection(ws: WS, room: Room, role: Role): void {
  const adapter: SocketLike = {
    send: (data) => {
      try {
        ws.send(data);
      } catch {
        // ignore — socket likely closed
      }
    },
    close: (code, reason) => {
      try {
        ws.close(code, reason);
      } catch {
        // ignore
      }
    },
  };

  const result = room.attach(adapter, role);
  if (!result.ok) {
    const code =
      result.error === "room-full"
        ? CLOSE_CODES.ROOM_FULL
        : result.error === "room-not-found"
          ? CLOSE_CODES.ROOM_NOT_FOUND
          : CLOSE_CODES.FORBIDDEN;
    ws.close(code, result.error);
    return;
  }
  const peerId = result.peerId;
  log("socket_attached", { uuid: room.uuid, role });

  ws.on("message", (data) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      ws.close(CLOSE_CODES.POLICY_VIOLATION, "invalid-json");
      room.detach(peerId);
      return;
    }
    room.receive(peerId, parsed);
  });

  ws.on("close", () => {
    room.detach(peerId);
    log("socket_detached", { uuid: room.uuid });
  });

  ws.on("error", () => {
    try {
      ws.terminate();
    } catch {
      // ignore
    }
    room.detach(peerId);
  });
}

function log(event: string, fields: Record<string, unknown> = {}): void {
  // Structured logs without payloads. No display names, no chapter ids,
  // no IPs (rate-limit only). Compatible with most log aggregators.
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), event, ...fields }),
  );
}

httpServer.listen(PORT, HOST, () => {
  log("listening", { host: HOST, port: PORT, allowedOrigins: ALLOWED_ORIGINS });
});

const shutdown = (signal: string) => {
  log("shutting_down", { signal });
  for (const room of rooms.values()) room.destroy("shutdown");
  rooms.clear();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

setInterval(() => roomLimiter.prune(), 5 * 60_000).unref();
