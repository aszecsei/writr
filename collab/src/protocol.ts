import { match, P } from "ts-pattern";
import { z } from "zod/v4";

export const ROLES = ["view", "review", "edit", "host"] as const;
export type Role = (typeof ROLES)[number];

export const DOC_KINDS = ["prose", "comments", "project"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const ERROR_CODES = [
  "invalid-token",
  "unauthorized",
  "invalid-message",
  "payload-too-large",
  "rate-limited",
  "room-full",
  "room-not-found",
  "internal",
  "join-rejected",
  "join-timeout",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const MAX_PAYLOAD_BYTES = 256 * 1024;

const roleSchema = z.enum(ROLES);
const docKindSchema = z.enum(DOC_KINDS);
const streamIdSchema = z.number().int().min(1);
const base64Schema = z.string().regex(/^[A-Za-z0-9+/_-]*={0,2}$/);
const peerIdSchema = z.string().min(1).max(64);
const requestIdSchema = z.string().min(1).max(64);
const displayNameSchema = z.string().min(1).max(64);
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// ─── Client → server ─────────────────────────────────────────────────

const yUpdateClientSchema = z.object({
  type: z.literal("y-update"),
  docKind: docKindSchema,
  streamId: streamIdSchema,
  payload: base64Schema,
});

const awarenessClientSchema = z.object({
  type: z.literal("awareness"),
  payload: base64Schema,
});

const joinRequestClientSchema = z.object({
  type: z.literal("join-request"),
  requestId: requestIdSchema,
  guestPub: base64Schema,
  displayName: displayNameSchema,
  color: colorSchema,
});

const joinApprovedClientSchema = z.object({
  type: z.literal("join-approved"),
  requestId: requestIdSchema,
  encryptedRoomKey: base64Schema,
  to: peerIdSchema,
});

const joinDeniedClientSchema = z.object({
  type: z.literal("join-denied"),
  requestId: requestIdSchema,
  reason: z.string().max(200).optional(),
  to: peerIdSchema,
});

const kickPeerClientSchema = z.object({
  type: z.literal("kick-peer"),
  peerId: peerIdSchema,
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  yUpdateClientSchema,
  awarenessClientSchema,
  joinRequestClientSchema,
  joinApprovedClientSchema,
  joinDeniedClientSchema,
  kickPeerClientSchema,
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

// ─── Server → client ─────────────────────────────────────────────────

const systemEventSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("host_disconnected"),
    deadline: z.number(),
  }),
  z.object({ event: z.literal("host_connected") }),
  z.object({
    event: z.literal("session_ended"),
    reason: z.enum(["host_left", "idle", "shutdown"]),
  }),
  z.object({
    event: z.literal("peer_joined"),
    peerId: peerIdSchema,
    role: roleSchema,
  }),
  z.object({
    event: z.literal("peer_left"),
    peerId: peerIdSchema,
  }),
  z.object({
    event: z.literal("join_request_cancelled"),
    requestId: requestIdSchema,
  }),
]);
export type SystemEvent = z.infer<typeof systemEventSchema>;

export const serverMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("welcome"),
    peerId: peerIdSchema,
    role: roleSchema,
    peerCount: z.number().int().min(0),
    hostPresent: z.boolean(),
  }),
  z.object({
    type: z.literal("y-update"),
    docKind: docKindSchema,
    streamId: streamIdSchema,
    payload: base64Schema,
    from: peerIdSchema,
  }),
  z.object({
    type: z.literal("awareness"),
    payload: base64Schema,
    from: peerIdSchema,
  }),
  z.object({
    type: z.literal("buffer"),
    docKind: docKindSchema,
    streamId: streamIdSchema,
    updates: z.array(base64Schema),
  }),
  z.object({
    type: z.literal("system"),
    data: systemEventSchema,
  }),
  z.object({
    type: z.literal("error"),
    code: z.enum(ERROR_CODES),
    message: z.string(),
  }),
  z.object({
    type: z.literal("join-request"),
    requestId: requestIdSchema,
    guestPub: base64Schema,
    displayName: displayNameSchema,
    color: colorSchema,
    from: peerIdSchema,
  }),
  z.object({
    type: z.literal("join-approved"),
    requestId: requestIdSchema,
    encryptedRoomKey: base64Schema,
  }),
  z.object({
    type: z.literal("join-denied"),
    requestId: requestIdSchema,
    reason: z.string().max(200).optional(),
  }),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;

export const CLOSE_CODES = {
  NORMAL: 1000,
  POLICY_VIOLATION: 1008,
  MESSAGE_TOO_BIG: 1009,
  FORBIDDEN: 4403,
  ROOM_NOT_FOUND: 4404,
  ROOM_FULL: 4413,
  SESSION_ENDED: 4410,
} as const;

/**
 * True when `role` is permitted to send `message`. Authoritative on the
 * relay (`room.ts`); mirrored client-side so the UI can pre-empt sends the
 * server would reject. The relay is the source of truth — it supplies its
 * own rejection reason when this returns false.
 */
export function canSend(role: Role, message: ClientMessage): boolean {
  return match(message)
    .with({ type: "awareness" }, () => true)
    .with({ type: "y-update" }, (m) => {
      if (m.docKind === "project") return role === "host";
      if (role === "view") return false;
      if (role === "review" && m.docKind !== "comments") return false;
      return true;
    })
    .with({ type: "join-request" }, () => role !== "host")
    .with(
      { type: P.union("join-approved", "join-denied") },
      () => role === "host",
    )
    .with({ type: "kick-peer" }, () => role === "host")
    .exhaustive();
}

/**
 * Error kinds that should tear down a connection (transport-level, or a
 * client bug) rather than being silently dropped. Union of what `attach.ts`,
 * `lifecycle.ts`, and `handshake.ts` each treated as fatal before they were
 * consolidated onto this single set.
 */
const FATAL_ERROR_KINDS: ReadonlySet<string> = new Set<string>([
  "transport",
  ...ERROR_CODES,
]);

export function isFatalErrorKind(kind: string): boolean {
  return FATAL_ERROR_KINDS.has(kind);
}
